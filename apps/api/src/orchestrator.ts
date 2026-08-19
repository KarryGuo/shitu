import crypto from 'node:crypto'
import type { RunDTO, RunStepDTO, InjectMode, ToolCallRecord, AuditEntry, ClaimChoice } from '@shitu/shared'
import { mutate, getState, uid, nowIso } from './store.js'
import { getCar, getMainCar, addEvent, addBooking, completeCareReminder, DEMO_TODAY } from './profile.js'
import { senseMaintenance } from './rules.js'
import {
  manualSearch, shopSearch, priceCompare, ratingAggregate,
  bookingCreate, calendarSync, reminderCreate, sleep, withRecord, paceMs, type ManualItem,
  claimShopSearch, materialListGenerate, claimSubmit,
} from './tools.js'
import { generatePlanNarrative, assessDamage } from './llm.js'

/**
 * 保养管家编排器（§8.1 核心闭环 ①）：
 * 感知(规则) → 方案(手册工具+LLM/规则降级) → 比价(门店工具,可超时降级)
 * → 人工确认(HMAC token + TTL, 无确认不执行) → 执行(幂等预约) → 档案回写。
 * 每一步落库留痕（agent_steps 语义），工具失败自动降级并明确告知。
 */

const CONFIRM_SECRET = process.env.CONFIRM_SECRET ?? 'shitu-demo-secret'
const CONFIRM_TTL_SEC = Number(process.env.CONFIRM_TTL_SEC ?? 120)

const hmacToken = (runId: string, confirmId: string) =>
  crypto.createHmac('sha256', CONFIRM_SECRET).update(`${runId}:${confirmId}`).digest('hex').slice(0, 24)

function pushStep(runId: string, step: Omit<RunStepDTO, 'seq' | 'at'>): RunStepDTO {
  return mutate((s) => {
    const run = s.runs.find((r) => r.id === runId)!
    const full: RunStepDTO = { ...step, seq: run.steps.length + 1, at: nowIso() }
    run.steps.push(full)
    s.audit.push({ at: full.at, actor: 'agent', action: `step:${full.kind}`, detail: full.title, runId })
    if (s.audit.length > 200) s.audit.splice(0, s.audit.length - 200)
    return full
  })
}

function audit(actor: AuditEntry['actor'], action: string, detail?: string, runId?: string) {
  mutate((s) => {
    s.audit.push({ at: nowIso(), actor, action, detail, runId })
    if (s.audit.length > 200) s.audit.splice(0, s.audit.length - 200)
  })
}

export function createCareRun(inject: InjectMode = 'none', ttlSec = CONFIRM_TTL_SEC): RunDTO {
  const run: RunDTO = {
    id: uid('run'),
    scenario: 'care',
    status: 'running',
    inject,
    steps: [],
    degradations: [],
    createdAt: nowIso(),
  }
  mutate((s) => {
    s.runs.unshift(run)
    if (s.runs.length > 50) s.runs.splice(50)
  })
  audit('user', 'run:create', `scenario=care inject=${inject}`, run.id)
  void executeCare(run.id, ttlSec).catch(async (e) => {
    failRun(run.id, (e as Error).message)
  })
  return run
}

export function failRun(runId: string, message: string) {
  mutate((s) => {
    const run = s.runs.find((r) => r.id === runId)
    if (!run || run.status === 'done' || run.status === 'failed') return
    run.status = 'failed'
    run.finishedAt = nowIso()
  })
  pushStep(runId, { kind: 'error', seal: '错', title: '系统 · 任务失败', error: message })
  audit('system', 'run:failed', message, runId)
}

export function getRun(runId: string): RunDTO | undefined {
  const run = getState().runs.find((r) => r.id === runId)
  if (!run) return undefined
  // 懒惰过期：等待确认超时 → 任务作废（无确认不执行）
  if (run.status === 'waiting') {
    const confirm = run.steps.find((st) => st.confirm)?.confirm
    if (confirm && new Date(confirm.expiresAt).getTime() <= Date.now()) {
      mutate((s) => {
        const r = s.runs.find((x) => x.id === runId)
        if (r && r.status === 'waiting') {
          r.status = 'failed'
          r.finishedAt = nowIso()
        }
      })
      pushStep(runId, {
        kind: 'error', seal: '超', title: '识途 · 确认超时',
        error: '确认单已过期（120 秒），本次任务自动作废。未确认的方案不会执行任何写操作，可随时重新发起。',
      })
      audit('system', 'confirm:expired', undefined, runId)
    }
  }
  return getState().runs.find((r) => r.id === runId)
}

async function executeCare(runId: string, ttlSec: number) {
  const run = getState().runs.find((r) => r.id === runId)!
  const car = getMainCar()

  /* ---- STEP 1 感知（规则引擎，不依赖 LLM） ---- */
  await sleep(paceMs * 0.5)
  const sense = senseMaintenance(car, DEMO_TODAY)
  if (!sense.triggered) {
    pushStep(runId, {
      kind: 'sense', seal: '感', title: '识途 · 主动感知',
      body: `当前里程 ${sense.mileage.toLocaleString()} km，本周期 ${sense.kmSinceLast.toLocaleString()} km / ${sense.monthsSinceLast} 个月，暂未到保养窗口。`,
    })
    return finishRun(runId, '本次未触发保养任务。')
  }
  pushStep(runId, {
    kind: 'sense', seal: '感', title: '识途 · 主动感知',
    body: `您的车已行驶 **${sense.mileage.toLocaleString()} km**，距上次保养 **${sense.monthsSinceLast} 个月**（本周期 ${sense.kmSinceLast.toLocaleString()} km）。按手册周期（1 万公里 / 12 个月）并结合${sense.season}，建议本周安排保养。`,
  })

  /* ---- STEP 2 方案（手册检索 + 档案读取 + LLM/规则生成） ---- */
  await sleep(paceMs * 0.6)
  const toolRecs: ToolCallRecord[] = []
  const manual = await withRecord(toolRecs, '保养手册检索', () => manualSearch())
  const items = manual.data ?? ([] as ManualItem[])
  await withRecord(toolRecs, '档案读取 · 保养历史', async () => {
    await sleep(paceMs * 0.5)
    return { ok: true, data: { events: car.events.length }, source: 'sim' as const, latencyMs: 0 }
  })
  const llm = await generatePlanNarrative(
    {
      mileage: sense.mileage, monthsSinceLast: sense.monthsSinceLast, kmSinceLast: sense.kmSinceLast,
      season: sense.season, items, priceLow: 480, priceHigh: 620,
    },
    run.inject,
  )
  const planStep = pushStep(runId, {
    kind: 'plan', seal: '案', title: `识途 · 保养方案（${llm.provider}）`,
    body: llm.text, tools: toolRecs, degraded: llm.degraded,
  })
  if (llm.degraded) addDegradation(runId, llm.note)
  void planStep

  /* ---- STEP 3 三方比价（门店搜索可注入超时 → 缓存降级） ---- */
  await sleep(paceMs * 0.6)
  const quoteRecs: ToolCallRecord[] = []
  const shop = await withRecord(quoteRecs, '门店搜索 · 3km 内', () => shopSearch(run.inject))
  let rows = shop.data ?? []
  const cmp = await withRecord(quoteRecs, '报价比对', async () => {
    await sleep(paceMs * 0.4)
    return { ok: true, data: { rows: rows.length }, source: 'sim' as const, latencyMs: 0 }
  })
  void cmp
  await withRecord(quoteRecs, '评分聚合', () => ratingAggregate())
  rows = priceCompare(rows)
  const degradedQuote = shop.degraded || shop.source === 'cache'
  pushStep(runId, {
    kind: 'quote', seal: '价', title: '识途 · 三方比价',
    body: degradedQuote
      ? '**⚠ 门店搜索超时，以下为缓存报价（可能过期），以门店确认为准。**\n推荐门店含免费全车检测，周六上午有空位。是否预约？'
      : '推荐门店含免费全车检测，周六上午有空位。是否预约？',
    table: rows, tools: quoteRecs, degraded: degradedQuote,
  })
  if (degradedQuote) addDegradation(runId, shop.error)

  /* ---- STEP 4 车主意向 + 人工确认（无确认不执行） ---- */
  await sleep(paceMs * 0.6)
  pushStep(runId, { kind: 'user', seal: '您', title: '车主', body: '约周六上午，顺便看看雨刮。' })

  const best = rows.find((r) => r.best) ?? rows[0]
  const confirmId = uid('cf')
  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString()
  const slotPreview = nextSlotPreview()
  pushStep(runId, {
    kind: 'confirm', seal: '确', title: '识途 · 停车确认（无确认不执行）',
    confirm: {
      id: confirmId,
      title: `确认预约：${slotPreview} · ${best.name}`,
      lines: [
        `项目：${items.map((i) => i.name).join(' + ')}`,
        `预估 ${best.price} 元（含免费全车检测）`,
        '确认后写入预约单并同步日历提醒',
      ],
      token: hmacToken(runId, confirmId),
      expiresAt,
      secondsLeft: ttlSec,
    },
  })
  mutate((s) => {
    const r = s.runs.find((x) => x.id === runId)
    if (r) r.status = 'waiting'
  })
  audit('agent', 'confirm:requested', `ttl=${ttlSec}s`, runId)
}

function nextSlotPreview() {
  const d = new Date(DEMO_TODAY)
  const delta = (6 - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + delta)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} 09:30`
}

function addDegradation(runId: string, note?: string) {
  if (!note) return
  mutate((s) => {
    const r = s.runs.find((x) => x.id === runId)
    if (r && !r.degradations.includes(note)) r.degradations.push(note)
  })
}

/** 确认/拒绝：校验 token 与有效期后，从执行阶段续跑 */
export function decideRun(runId: string, token: string, decision: 'approve' | 'reject'): { ok: boolean; error?: string } {
  const run = getState().runs.find((r) => r.id === runId)
  if (!run) return { ok: false, error: 'RUN_NOT_FOUND' }
  const step = [...run.steps].reverse().find((st) => st.confirm)
  const cf = step?.confirm
  if (!cf) return { ok: false, error: 'CONFIRM_NOT_FOUND' }
  if (token !== hmacToken(runId, cf.id)) return { ok: false, error: 'CONFIRM_TOKEN_INVALID' }
  if (new Date(cf.expiresAt).getTime() <= Date.now()) {
    getRun(runId) // 触发懒惰过期（标记 failed + 超时步骤）
    return { ok: false, error: 'CONFIRM_EXPIRED' }
  }
  if (run.status !== 'waiting') return { ok: false, error: 'RUN_NOT_WAITING' }

  if (decision === 'reject') {
    mutate((s) => {
      const r = s.runs.find((x) => x.id === runId)
      if (r) { r.status = 'cancelled'; r.finishedAt = nowIso() }
    })
    pushStep(runId, {
      kind: 'done', seal: '妥', title: '识途 · 已取消',
      body: '好的，本次方案已存档。您可随时从提醒列表重新发起，报价 48 小时内有效。',
    })
    audit('user', 'confirm:rejected', undefined, runId)
    return { ok: true }
  }

  mutate((s) => {
    const r = s.runs.find((x) => x.id === runId)
    if (r) r.status = 'running'
  })
  audit('user', 'confirm:approved', undefined, runId)
  pushStep(runId, { kind: 'user', seal: '您', title: '车主', body: '确认，就这样办。' })

  const scenario = getState().runs.find((r) => r.id === runId)?.scenario
  void (scenario === 'claim' ? executeClaim(runId) : executeBooking(runId)).catch((e) =>
    failRun(runId, (e as Error).message),
  )
  return { ok: true }
}

/* ===================== 理赔护航（闭环 ②） ===================== */

/**
 * 照片接收 → 多模态定损（Qwen-VL 可降级）→ 决策参考（车主选择）
 * → 人工确认（HMAC token + TTL）→ 材料清单与预约（幂等）→ 档案归档。
 * 照片仅在内存中转用于识别，不落盘不持久化（隐私合规）。
 */
export function createClaimRun(inject: InjectMode = 'none', photoDataUrl?: string): RunDTO {
  const run: RunDTO = {
    id: uid('run'),
    scenario: 'claim',
    status: 'running',
    inject,
    steps: [],
    degradations: [],
    createdAt: nowIso(),
  }
  mutate((s) => {
    s.runs.unshift(run)
    if (s.runs.length > 50) s.runs.splice(50)
  })
  audit('user', 'run:create', `scenario=claim inject=${inject}${photoDataUrl ? ' photo=user-upload' : ' photo=sample'}`, run.id)
  void executeClaimFlow(run.id, photoDataUrl).catch((e) => failRun(run.id, (e as Error).message))
  return run
}

async function executeClaimFlow(runId: string, photoDataUrl?: string) {
  const run = getState().runs.find((r) => r.id === runId)!

  /* ---- STEP 1 照片接收 ---- */
  await sleep(paceMs * 0.5)
  pushStep(runId, {
    kind: 'sense', seal: '感', title: '识途 · 已接收照片',
    body: photoDataUrl
      ? '已接收你上传的现场照片（**经 API 中转加密，仅用于本次识别，不落盘**）。开始多模态识别与费用测算。'
      : '已接收样例照片（**经 API 中转加密，仅用于本次识别，不落盘**）。开始多模态识别与费用测算。你也可在开始前上传真实损伤照片。',
  })

  /* ---- STEP 2 多模态定损（Qwen-VL / 规则降级）---- */
  await sleep(paceMs * 0.6)
  const recs: ToolCallRecord[] = []
  await withRecord(recs, '照片上传 · R2 中转', async () => {
    await sleep(paceMs * 0.5)
    return { ok: true, data: { stored: false }, source: 'sim' as const, latencyMs: 0 }
  })
  const assess = await withRecord(recs, 'Qwen-VL 定损', async () => {
    const r = await assessDamage(photoDataUrl, run.inject)
    return {
      ok: true, degraded: r.degraded, source: 'sim' as const, latencyMs: 0,
      data: r, error: r.note,
    }
  })
  await withRecord(recs, '费用规则测算', async () => {
    await sleep(paceMs * 0.5)
    return { ok: true, data: { range: '380–520' }, source: 'sim' as const, latencyMs: 0 }
  })
  const a = assess.data!
  pushStep(runId, {
    kind: 'plan', seal: '案', title: `识途 · 定损结果（${a.provider} · 附置信度）`,
    body: a.confidence >= 0.7
      ? '置信度 ≥70%，无需人工复核。若置信度不足，识途会明确提示「建议人工核实」—— 不会硬给结论。'
      : '**置信度不足 70%，建议人工核实后再决策。**',
    assess: a, tools: recs, degraded: a.degraded,
  })
  if (a.degraded) addDegradation(runId, a.note)

  /* ---- STEP 3 决策参考（等待车主选择，无 TTL）---- */
  await sleep(paceMs * 0.6)
  pushStep(runId, {
    kind: 'quote', seal: '价', title: '识途 · 决策参考：走保险还是自费？',
    body: '结合损伤程度与保费影响给出的参考（最终决策在你）：',
    options: [
      { id: 'self', label: '自费维修', price: '¥380–520', note: '一次了结 · 不出险\n不影响次年保费（约省 ¥300–450）', badge: '更划算' },
      { id: 'claim', label: '走保险理赔', price: '¥0（本次）', note: '出险记录保留 3 年\n次年保费预计上浮 ¥300–450' },
    ],
  })
  mutate((s) => {
    const r = s.runs.find((x) => x.id === runId)
    if (r) { r.status = 'waiting'; r.choicePending = true }
  })
  audit('agent', 'choice:requested', 'self|claim', runId)
}

/** 车主决策（自费/走保险）→ 生成对应确认单 */
export function chooseClaim(runId: string, choice: ClaimChoice): { ok: boolean; error?: string } {
  const run = getState().runs.find((r) => r.id === runId)
  if (!run) return { ok: false, error: 'RUN_NOT_FOUND' }
  if (run.status !== 'waiting' || !run.choicePending) return { ok: false, error: 'CHOICE_INVALID' }

  mutate((s) => {
    const r = s.runs.find((x) => x.id === runId)
    if (r) { r.choice = choice; r.choicePending = false }
  })
  audit('user', `choice:${choice}`, undefined, runId)
  pushStep(runId, {
    kind: 'user', seal: '您', title: '车主',
    body: choice === 'self' ? '小伤不走保险了，帮我安排自费修。' : '这次走保险，帮我准备材料。',
  })

  const confirmId = uid('cf')
  const expiresAt = new Date(Date.now() + CONFIRM_TTL_SEC * 1000).toISOString()
  pushStep(runId, {
    kind: 'confirm', seal: '确', title: '识途 · 停车确认（无确认不执行）',
    confirm: {
      id: confirmId,
      title: choice === 'self' ? '确认按「自费维修」处理本次剐蹭' : '确认按「走保险」处理本次剐蹭',
      lines:
        choice === 'self'
          ? ['维修内容：右后车门 钣金修复 + 补漆', '预估 ¥380–520 · 门店：顺达认证修理厂（3.4 km）', '生成材料清单并创建预约单（待确认状态）']
          : ['报案方式建议：先现场拍照，再联系保险公司', '识途生成报案话术与材料清单', '最终定损以保险公司为准'],
      token: hmacToken(runId, confirmId),
      expiresAt,
      secondsLeft: CONFIRM_TTL_SEC,
    },
  })
  audit('agent', 'confirm:requested', `ttl=${CONFIRM_TTL_SEC}s`, runId)
  return { ok: true }
}

async function executeClaim(runId: string) {
  const run = getState().runs.find((r) => r.id === runId)!
  const choice: ClaimChoice = run.choice ?? 'self'
  const car = getMainCar()

  /* ---- STEP 执行（材料清单 / 门店匹配 / 幂等提交）---- */
  await sleep(paceMs * 0.6)
  const recs: ToolCallRecord[] = []
  const mats = await withRecord(recs, '材料清单生成', async () => {
    const r = await materialListGenerate(choice)
    return { ok: r.ok, data: { n: r.items.length }, source: 'sim' as const, latencyMs: 0 }
  })
  const shops = await withRecord(recs, '门店方案匹配', () => claimShopSearch(run.inject))
  const submit = await withRecord(recs, choice === 'self' ? '预约单创建 · proposed' : '报案材料提交 · 幂等键', async () => {
    const r = await claimSubmit(runId)
    return { ok: r.ok, data: r, source: 'sim' as const, latencyMs: 0 }
  })
  const degradedShop = shops.degraded || shops.source === 'cache'
  pushStep(runId, {
    kind: 'execute', seal: '行', title: '识途 · 执行',
    tools: recs,
    body: `材料清单已生成：${(mats.data ? ['现场照片 · 行驶证 · 驾驶证'] : []).join('')}${choice === 'claim' ? ' · 保单号 · 银行卡号（收款用）' : ''}。
单号 **${submit.data?.ref ?? 'CL------'}**。${
      choice === 'self'
        ? '已为你创建预约单（待确认）：顺达认证修理厂，周六 10:00，预估 ¥380–520。'
        : '已整理报案话术与材料清单，按流程联系保险公司即可。'
    }${degradedShop ? '\n**⚠ 门店信息来自缓存（可能变化），以门店最终确认为准。**' : ''}`,
    degraded: degradedShop,
  })
  if (degradedShop) addDegradation(runId, shops.error)

  /* ---- STEP 档案归档 ---- */
  await sleep(paceMs * 0.6)
  addBooking({
    carId: car.static.id,
    shopName: choice === 'self' ? '顺达认证修理厂' : '保险公司定损点（待分配）',
    startsAt: '2026-08-22 10:00',
    items: choice === 'self' ? '右后车门 钣金修复 + 补漆' : '保险报案 · 材料提交',
    priceEstimate: choice === 'self' ? '¥380–520' : '以保险公司定损为准',
    status: 'proposed',
  })
  const assess = run.steps.find((st) => st.assess)?.assess
  addEvent(car.static.id, {
    type: choice === 'self' ? 'repair' : 'claim',
    occurredAt: '2026-08-18',
    title: choice === 'self' ? '剐蹭自费维修（已安排）' : '剐蹭保险报案（进行中）',
    detail: `${assess?.part ?? '右后车门'} · ${assess?.severity ?? '轻度划伤'} · 识途辅助定损 ${assess?.range ?? '380–520 元'}`,
  })
  pushStep(runId, {
    kind: 'writeback', seal: '成', title: '识途 · 已办完',
    body: '本次记录已归档至事件域，作为车况履历与残值依据的一部分。',
  })

  finishRun(runId, '任务闭环完成：照片 → 定损 → 决策 → 确认 → 材料与预约 → 归档')
}

async function executeBooking(runId: string) {
  const run = getState().runs.find((r) => r.id === runId)!
  const car = getMainCar()
  const quoteStep = run.steps.find((st) => st.table)
  const best = quoteStep?.table?.find((r) => r.best) ?? quoteStep?.table?.[0]
  const shopName = best?.name ?? '畅行连锁养护'
  const price = best?.price ?? 486
  const planStep = run.steps.find((st) => st.kind === 'plan')
  const itemNames = (planStep?.body ?? '').split('\n')
    .filter((l) => l.trim().startsWith('·'))
    .map((l) => l.replace(/^·\s*/, '').split(' —— ')[0].split('（')[0].trim())
    .filter((n) => n && n !== '本次建议项目')
  const items = itemNames.length ? itemNames.join('+') : '机油+机滤+空调滤芯+雨刮检查'

  /* ---- STEP 5 执行（幂等预约 + 日历 + 提醒） ---- */
  await sleep(paceMs * 0.6)
  const recs: ToolCallRecord[] = []
  // 幂等键 = runId：重复执行不会产生重复预约单
  const booking = await withRecord(recs, '门店预约接口 · 幂等键', async () => {
    const r = await bookingCreate(shopName, items, runId)
    return { ok: r.ok, data: r, source: 'sim' as const, latencyMs: 0 }
  })
  const cal = await withRecord(recs, '日历同步', async () => {
    const r = await calendarSync(booking.data?.startsAt ?? '', '保养预约')
    return { ok: r.ok, data: r, source: 'sim' as const, latencyMs: 0 }
  })
  const rem = await withRecord(recs, '提醒任务创建', async () => {
    const r = await reminderCreate('前一天 20:00')
    return { ok: r.ok, data: r, source: 'sim' as const, latencyMs: 0 }
  })
  void cal; void rem
  pushStep(runId, {
    kind: 'execute', seal: '行', title: '识途 · 执行',
    tools: recs,
    body: `预约成功（预约号 **${booking.data?.bookingRef ?? 'BK------'}**），已同步日历；前一天 20:00 我会提醒您，并附门店导航。`,
  })

  /* ---- STEP 6 档案回写 ---- */
  await sleep(paceMs * 0.6)
  const startsAt = booking.data?.startsAt ?? nextSlotPreview()
  addBooking({ carId: car.static.id, shopName, startsAt, items, priceEstimate: `¥${price}`, status: 'confirmed' })
  addEvent(car.static.id, {
    type: 'maintenance',
    occurredAt: startsAt.slice(0, 10),
    title: '保养预约（已确认）',
    detail: `${shopName} · 预估 ¥${price} · ${car.state.mileage.toLocaleString()} km 时按手册周期预约`,
  })
  completeCareReminder(car.static.id)
  pushStep(runId, {
    kind: 'writeback', seal: '成', title: '识途 · 已办完',
    body: '本次记录已写入档案（事件域 + 预约单），作为下次保养预测与残值依据；对应提醒已关闭。',
  })

  await finishRun(runId, undefined)
}

function finishRun(runId: string, note?: string) {
  mutate((s) => {
    const r = s.runs.find((x) => x.id === runId)
    if (r && r.status !== 'failed') { r.status = 'done'; r.finishedAt = nowIso() }
  })
  pushStep(runId, {
    kind: 'done', seal: '✓', title: '任务闭环',
    body: note ?? '任务闭环完成：感知 → 方案 → 比价 → 确认 → 执行 → 档案回写',
  })
  audit('agent', 'run:done', undefined, runId)
}
