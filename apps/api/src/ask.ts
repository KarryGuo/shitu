/**
 * 对话式入口（自然语言问诊）：
 * 车主提问 → 档案三域构成的事实上下文 + LLM 生成回答 → 附带可执行的行动建议。
 * - LLM 只做「表达与解释」，事实全部来自档案（与方案生成同一条架构原则）
 * - 无 Key / 调用失败 → 规则链路用同样的档案事实生成确定性回答，如实标注降级
 */
import type { ProfileDTO } from '@shitu/shared'
import { senseMaintenance } from './rules.js'
import type { LlmOutcome } from './llm.js'

export type AskActionKind = 'care' | 'claim' | 'profile'

export interface AskAction {
  kind: AskActionKind
  label: string
}

export interface AskResult extends LlmOutcome {
  actions: AskAction[]
  /** 回答依据的档案事实（前端可展开「依据」） */
  facts: string[]
}

const DEMO_TODAY = new Date('2026-08-18T09:00:00+08:00')

/** 档案事实抽取：回答与「依据」面板共用的唯一事实源 */
function profileFacts(p: ProfileDTO): string[] {
  const facts: string[] = []
  for (const car of p.cars) {
    facts.push(`${car.static.plateNo}（${car.static.model}）当前里程 ${car.state.mileage.toLocaleString()} km`)
    const s = senseMaintenance(car, DEMO_TODAY)
    if (s.kmSinceLast >= 7000)
      facts.push(`本保养周期已行驶 ${s.kmSinceLast.toLocaleString()} km（手册周期 10,000 km）`)
    if (s.monthsSinceLast >= 11) facts.push(`距上次保养 ${s.monthsSinceLast} 个月（手册周期 12 个月）`)
    facts.push(`保险到期 ${car.state.insuranceExpiry} · 年检到期 ${car.state.inspectionExpiry}`)
    facts.push(`季节提示：${s.season}`)
  }
  const pending = p.reminders.filter((r) => r.status === 'pending' || r.status === 'snoozed')
  if (pending.length) facts.push(`待办提醒 ${pending.length} 项：${pending.map((r) => r.title).join('、')}`)
  const lastEvent = [...p.cars.flatMap((c) => c.events)].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]
  if (lastEvent) facts.push(`最近档案事件：${lastEvent.title}（${lastEvent.occurredAt.slice(0, 10)}）`)
  if (p.bookings.length) facts.push(`已有预约 ${p.bookings.length} 单`)
  return facts
}

/** 规则链路：同样的档案事实，确定性表达（LLM 不可用时的兜底） */
function ruleAnswer(facts: string[], question: string): string {
  const q = question.toLowerCase()
  const head = facts.slice(0, 2).join('；')
  if (q.includes('事故') || q.includes('剐蹭') || q.includes('撞') || q.includes('理赔'))
    return `如发生事故：拍下损伤照片，「理赔」页一键发起，识途会完成多模态定损 → 自费/走保险建议 → 确认后生成材料清单与门店预约。当前档案：${head}。`
  if (q.includes('花') || q.includes('价') || q.includes('多少钱'))
    return `按您的档案，常规小保养区间约 400–700 元（含机油机滤工时），具体以方案比价为准。当前档案：${head}。`
  return `根据档案：${facts.join('；')}。建议尽快处理到期项，识途可比价后一键预约。`
}

/** 行动建议：关键词 + 档案状态共同决定（不是让 LLM 编造可执行动作） */
function suggestActions(question: string, p: ProfileDTO): AskAction[] {
  const q = question.toLowerCase()
  const actions: AskAction[] = []
  const careDue = p.cars.some((c) => senseMaintenance(c, DEMO_TODAY).triggered)
  const pending = p.reminders.filter((r) => r.status === 'pending' || r.status === 'snoozed')

  if (q.includes('事故') || q.includes('剐蹭') || q.includes('撞') || q.includes('理赔') || q.includes('保险'))
    actions.push({ kind: 'claim', label: '发起理赔定损' })
  if (q.includes('保养') || q.includes('换油') || q.includes('检') || careDue)
    actions.push({ kind: 'care', label: careDue ? '保养已到期 · 发起保养' : '发起保养检查' })
  if (q.includes('充电') || q.includes('加油') || q.includes('洗车'))
    actions.push({ kind: 'profile', label: '查看周边充电/加油/洗车' })
  if (pending.length && actions.length === 0)
    actions.push({ kind: 'care', label: `处理 ${pending.length} 项到期提醒` })
  return actions.slice(0, 2)
}

async function callLlm(question: string, facts: string[], timeoutMs = 12000): Promise<string> {
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
              '你是识途——车主的智能用车管家。只依据给出的档案事实回答车主问题，' +
              '不得编造档案里没有的数据；回答口语化、简短（3–5 行内），先给结论再给依据；' +
              '涉及保养/理赔的行动建议用一句话带过，不说价格以外的推测数字。' +
              '严禁声称你已经做了任何操作（如「已记下」「已预约」「已提醒」）——你只能建议，执行需车主确认；' +
              '需要行动时说「建议发起保养/理赔，我来代办」。',
          },
          { role: 'user', content: `【档案事实】\n${facts.join('\n')}\n\n【车主问题】${question}` },
        ],
      }),
    })
    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try {
        const j = (await res.json()) as { error?: { code?: string; message?: string } }
        if (j.error?.code) detail += ` ${j.error.code}`
      } catch { /* keep status */ }
      throw new Error(detail)
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const text = json.choices?.[0]?.message?.content?.trim()
    if (!text) throw new Error('empty completion')
    return text
  } finally {
    clearTimeout(timer)
  }
}

/** 对话式问诊入口：LLM 生成 + 规则兜底，行动建议始终由确定性逻辑给出 */
export async function askAgent(question: string, profile: ProfileDTO): Promise<AskResult> {
  const facts = profileFacts(profile)
  const actions = suggestActions(question, profile)
  const provider = process.env.LLM_PROVIDER ?? 'rule'

  if (provider === 'dashscope' && process.env.DASHSCOPE_API_KEY) {
    try {
      const text = await callLlm(question, facts)
      return { text, provider: process.env.LLM_MODEL ?? 'qwen-plus', degraded: false, actions, facts }
    } catch (e) {
      return {
        text: ruleAnswer(facts, question),
        provider: 'rule-fallback',
        degraded: true,
        note: `LLM 调用失败（${(e as Error).message}），已降级为规则链路回答`,
        actions,
        facts,
      }
    }
  }
  return { text: ruleAnswer(facts, question), provider: 'rule', degraded: false, actions, facts }
}
