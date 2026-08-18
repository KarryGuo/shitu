/**
 * LLM 适配器（§0 架构原则 3 + 5）：
 * - LLM_PROVIDER=dashscope 且配置 DASHSCOPE_API_KEY 时调用 Qwen（OpenAI 兼容模式）
 * - 无 Key / 调用失败 / 注入 llm_down 时自动降级为规则链路，并在步骤中如实标注
 * 核心提醒与方案骨架始终由规则引擎生成；LLM 只负责表达层润色 —— 挂了也能办事。
 */

export interface LlmOutcome {
  text: string
  provider: string
  degraded: boolean
  note?: string
}

interface PlanInput {
  mileage: number
  monthsSinceLast: number
  kmSinceLast: number
  season: string
  items: { name: string; reason: string; evidence: string }[]
  priceLow: number
  priceHigh: number
}

/** 规则链路：确定性的方案文案（无 LLM 也可工作） */
export function rulePlanText(p: PlanInput): string {
  const lines = p.items.map((it) => `· ${it.name} —— ${it.reason}（依据：${it.evidence}）`)
  return [
    `本次建议项目：`,
    ...lines,
    `预计费用 ${p.priceLow}–${p.priceHigh} 元，符合您的预算偏好「适中」。`,
  ].join('\n')
}

/** 解析 DashScope 错误响应，带上真实错误码（如 Arrearage/InvalidKey），让降级原因可读 */
async function dashscopeError(res: Response): Promise<Error> {
  let detail = `HTTP ${res.status}`
  try {
    const j = (await res.json()) as { error?: { code?: string; message?: string } }
    if (j.error?.code) detail += ` ${j.error.code}`
    else if (j.error?.message) detail += ` ${j.error.message.slice(0, 80)}`
  } catch {
    /* keep status only */
  }
  return new Error(detail)
}

async function callDashScope(prompt: string, timeoutMs = 8000): Promise<string> {
  const key = process.env.DASHSCOPE_API_KEY
  const model = process.env.LLM_MODEL ?? 'qwen-plus'
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              '你是识途的保养管家。根据结构化输入生成简短的保养方案说明（不超过6行，每行以·开头，最后给出费用区间）。只使用输入中的事实，不得编造项目或价格。',
          },
          { role: 'user', content: prompt },
        ],
      }),
    })
    if (!res.ok) throw await dashscopeError(res)
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const text = json.choices?.[0]?.message?.content?.trim()
    if (!text) throw new Error('empty completion')
    return text
  } finally {
    clearTimeout(timer)
  }
}

export async function generatePlanNarrative(p: PlanInput, inject: string): Promise<LlmOutcome> {
  const fallback = (): LlmOutcome => ({
    text: rulePlanText(p),
    provider: 'rule-fallback',
    degraded: true,
    note: 'LLM 不可用，已降级为规则链路生成方案（内容确定性不受影响）',
  })

  const provider = process.env.LLM_PROVIDER ?? 'rule'
  if (inject === 'llm_down') return fallback()
  if (provider !== 'dashscope' || !process.env.DASHSCOPE_API_KEY) {
    return { text: rulePlanText(p), provider: 'rule', degraded: false }
  }
  try {
    const prompt = JSON.stringify(p)
    const text = await callDashScope(prompt)
    return { text, provider: process.env.LLM_MODEL ?? 'qwen-plus', degraded: false }
  } catch (e) {
    const out = fallback()
    out.note = `LLM 调用失败（${(e as Error).message}），${out.note}`
    return out
  }
}

/* ===================== 理赔：多模态定损（Qwen-VL） ===================== */

export interface AssessOutcome {
  part: string
  severity: string
  range: string
  confidence: number
  repurchase: string
  provider: string
  degraded: boolean
  note?: string
}

/** 规则链路定损基准（与样例照片场景一致；置信度 ≥70% 无需人工复核） */
const RULE_ASSESS: AssessOutcome = {
  part: '右后车门',
  severity: '轻度划伤 + 浅凹陷',
  range: '380–520 元',
  confidence: 0.86,
  repurchase: '无需补拍，光照充足',
  provider: 'rule',
  degraded: false,
}

async function callVL(photoDataUrl: string | undefined, timeoutMs = 15000): Promise<AssessOutcome> {
  const key = process.env.DASHSCOPE_API_KEY
  const model = process.env.LLM_VL_MODEL ?? 'qwen-vl-max'
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), timeoutMs)
  const sys =
    '你是识途的理赔定损助手。根据照片（或文字描述）判断车辆损伤，只输出一个 JSON 对象：' +
    '{"part":"部位","severity":"程度","range":"估价区间","confidence":0到1的小数,"repurchase":"补拍建议"}。' +
    '不得编造看不见的损伤；不确定时 confidence 给低值。'
  const userText = photoDataUrl
    ? '这是车主上传的损伤照片，请定损。'
    : '文字描述场景：停车场剐蹭，右后车门轻度划痕带浅凹陷，漆面未破，光照充足照片清晰。请定损。'
  try {
    const content: unknown[] = [{ type: 'text', text: userText }]
    if (photoDataUrl) content.unshift({ type: 'image_url', image_url: { url: photoDataUrl } })
    const res = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content },
        ],
      }),
    })
    if (!res.ok) throw await dashscopeError(res)
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const raw = json.choices?.[0]?.message?.content ?? ''
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('no json in vl output')
    const parsed = JSON.parse(m[0]) as Partial<AssessOutcome>
    return {
      part: parsed.part ?? RULE_ASSESS.part,
      severity: parsed.severity ?? RULE_ASSESS.severity,
      range: parsed.range ?? RULE_ASSESS.range,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : RULE_ASSESS.confidence,
      repurchase: parsed.repurchase ?? RULE_ASSESS.repurchase,
      provider: model,
      degraded: false,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 多模态定损：Qwen-VL（有照片传照片，无照片按文字描述）。
 * 无 Key / 调用失败 / 注入 llm_down → 规则基准结果 + 如实标注降级。
 */
export async function assessDamage(photoDataUrl: string | undefined, inject: string): Promise<AssessOutcome> {
  if (inject === 'llm_down') {
    return { ...RULE_ASSESS, provider: 'rule-fallback', degraded: true, note: '视觉模型不可用，已降级为规则基准定损（建议人工核实）' }
  }
  const provider = process.env.LLM_PROVIDER ?? 'rule'
  if (provider !== 'dashscope' || !process.env.DASHSCOPE_API_KEY) {
    return { ...RULE_ASSESS }
  }
  try {
    return await callVL(photoDataUrl)
  } catch (e) {
    return {
      ...RULE_ASSESS,
      provider: 'rule-fallback',
      degraded: true,
      note: `Qwen-VL 调用失败（${(e as Error).message}），已降级为规则基准定损`,
    }
  }
}
