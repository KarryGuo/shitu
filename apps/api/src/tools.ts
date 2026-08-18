import type { QuoteRow, ToolCallRecord } from '@shitu/shared'

/**
 * 工具适配层（§0 架构原则 3：外部服务走适配器 + 环境变量切换）。
 * 演示实现为模拟数据 + 模拟延迟；接口契约与失败语义与真实实现一致，
 * 复赛阶段按 MAP_KEY / SHOP_API_KEY 等环境变量切换到真实开放平台。
 */

export interface ToolOutcome<T> {
  ok: boolean
  data?: T
  error?: string
  degraded?: boolean
  source: 'live' | 'cache' | 'sim'
  latencyMs: number
}

export const paceMs = Number(process.env.CARE_PACE ?? 600)
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)))

/** 记录单个工具调用的执行与耗时（写入 agent_steps 审计） */
export async function withRecord<T>(
  records: ToolCallRecord[],
  name: string,
  fn: () => Promise<ToolOutcome<T>>,
): Promise<ToolOutcome<T>> {
  const rec: ToolCallRecord = { name, status: 'running' }
  records.push(rec)
  const t0 = Date.now()
  try {
    const out = await fn()
    rec.latencyMs = Date.now() - t0
    rec.status = out.degraded ? 'degraded' : out.ok ? 'ok' : 'failed'
    if (out.degraded || !out.ok) rec.note = out.error ?? '已降级'
    return out
  } catch (e) {
    rec.latencyMs = Date.now() - t0
    rec.status = 'failed'
    rec.note = (e as Error).message
    return { ok: false, error: (e as Error).message, source: 'sim', latencyMs: rec.latencyMs }
  }
}

/* ---------------- 保养手册检索（知识库 / RAG 演示实现） ---------------- */

export interface ManualItem {
  name: string
  reason: string
  evidence: string
  priceLow: number
  priceHigh: number
}

const MANUAL: ManualItem[] = [
  { name: '机油 + 机滤', reason: '手册周期已到', evidence: '保养手册 P12', priceLow: 320, priceHigh: 420 },
  { name: '空调滤芯', reason: '上次更换于 21,200 km 前', evidence: '档案 · 事件域 e3', priceLow: 80, priceHigh: 120 },
  { name: '雨刮检查', reason: '雨季将至，免费检查项', evidence: '季节性建议', priceLow: 0, priceHigh: 0 },
]

export async function manualSearch(): Promise<ToolOutcome<ManualItem[]>> {
  await sleep(paceMs * 0.8)
  return { ok: true, data: [...MANUAL], source: 'sim', latencyMs: 0 }
}

/* ---------------- 门店搜索 + 比价（可注入超时 → 缓存降级） ---------------- */

const LIVE_QUOTES: QuoteRow[] = [
  { name: '畅行连锁养护', price: 486, distance: '1.2 km', rating: 4.8, note: '含免费全车检测 · 周六上午有空位', source: 'live' },
  { name: '顺达认证修理厂', price: 452, distance: '3.4 km', rating: 4.5, source: 'live' },
  { name: '品牌 4S 店', price: 738, distance: '5.1 km', rating: 4.7, source: 'live' },
]

/** 降级用的缓存报价（与 live 同源，标注 cache 以便前端提示"可能过期"） */
const CACHE_QUOTES: QuoteRow[] = LIVE_QUOTES.map((q) => ({ ...q, source: 'cache' }))

export async function shopSearch(inject: string): Promise<ToolOutcome<QuoteRow[]>> {
  const latency = paceMs * 1.2
  if (inject === 'shop_timeout') {
    // 模拟真实开放平台超时（生产为 AbortController + 重试），随后走降级链路
    await sleep(latency * 2)
    return {
      ok: true, degraded: true, source: 'cache', latencyMs: latency * 2,
      data: CACHE_QUOTES,
      error: '门店开放平台响应超时（2×' + Math.round(latency) + 'ms），已降级为本地缓存报价，价格可能过期',
    }
  }
  await sleep(latency)
  return { ok: true, data: LIVE_QUOTES.map((q) => ({ ...q })), source: 'live', latencyMs: latency }
}

/** 报价比对：评分加权后选性价比（价格 ≤ 均值 且 评分最高） */
export function priceCompare(rows: QuoteRow[]): QuoteRow[] {
  const avg = rows.reduce((a, b) => a + b.price, 0) / rows.length
  const eligible = rows.filter((r) => r.price <= avg)
  const best = eligible.reduce((a, b) => (b.rating > a.rating ? b : a))
  return rows.map((r) => (r.name === best.name ? { ...r, best: true } : r))
}

export async function ratingAggregate(): Promise<ToolOutcome<{ provider: string }>> {
  await sleep(paceMs * 0.5)
  return { ok: true, data: { provider: '地图开放平台（演示聚合）' }, source: 'sim', latencyMs: 0 }
}

/* ---------------- 预约执行（幂等：同 key 重复调用返回同一预约） ---------------- */

const bookingMemo = new Map<string, { bookingRef: string; startsAt: string }>()

export function nextSaturday930(from = new Date()): string {
  const d = new Date(from)
  const delta = (6 - d.getDay() + 7) % 7 || 7 // 下一个周六（今天周六则顺延一周）
  d.setDate(d.getDate() + delta)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} 09:30`
}

export async function bookingCreate(shopName: string, items: string, idempotencyKey: string) {
  await sleep(paceMs * 0.8)
  let v = bookingMemo.get(idempotencyKey)
  if (!v) {
    v = { bookingRef: `BK${Math.random().toString(36).slice(2, 8).toUpperCase()}`, startsAt: nextSaturday930() }
    bookingMemo.set(idempotencyKey, v)
  }
  return { ok: true as const, ...v }
}

export async function calendarSync(startsAt: string, title: string) {
  await sleep(paceMs * 0.5)
  return { ok: true as const, eventRef: `CAL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, startsAt, title }
}

export async function reminderCreate(when: string) {
  await sleep(paceMs * 0.4)
  return { ok: true as const, taskId: `TSK${Math.random().toString(36).slice(2, 7).toUpperCase()}`, when }
}

/* ===================== 理赔工具（闭环 ②） ===================== */

export interface ClaimShop {
  name: string
  type: string
  distance: string
  note: string
}

const LIVE_CLAIM_SHOPS: ClaimShop[] = [
  { name: '顺达认证修理厂', type: '综合维修 · 可钣金补漆', distance: '3.4 km', note: '报价 ¥380–520 · 周六 10:00 有空位' },
  { name: '保险公司定损点（城南）', type: '官方定损 · 直赔', distance: '6.8 km', note: '需先报案分配' },
]

const CACHE_CLAIM_SHOPS = LIVE_CLAIM_SHOPS.map((s) => ({ ...s, note: `${s.note}（缓存）` }))

/** 门店/定损点匹配（insurer_timeout 注入 → 缓存降级） */
export async function claimShopSearch(inject: string): Promise<ToolOutcome<ClaimShop[]>> {
  const latency = paceMs * 1.1
  if (inject === 'insurer_timeout') {
    await sleep(latency * 2)
    return {
      ok: true, degraded: true, source: 'cache', latencyMs: latency * 2,
      data: CACHE_CLAIM_SHOPS,
      error: '保险/门店开放平台响应超时，已降级为本地缓存方案（营业信息可能变化，以门店确认为准）',
    }
  }
  await sleep(latency)
  return { ok: true, data: LIVE_CLAIM_SHOPS.map((s) => ({ ...s })), source: 'live', latencyMs: latency }
}

export async function materialListGenerate(choice: 'self' | 'claim') {
  await sleep(paceMs * 0.6)
  const base = ['现场照片', '行驶证', '驾驶证']
  return {
    ok: true as const,
    items: choice === 'claim' ? [...base, '保单号', '银行卡号（收款用）'] : base,
  }
}

const claimMemo = new Map<string, { ref: string }>()

/** 报案/预约单提交（幂等：同 runId 重复调用返回同一单号） */
export async function claimSubmit(idempotencyKey: string) {
  await sleep(paceMs * 0.7)
  let v = claimMemo.get(idempotencyKey)
  if (!v) {
    v = { ref: `CL${Math.random().toString(36).slice(2, 8).toUpperCase()}` }
    claimMemo.set(idempotencyKey, v)
  }
  return { ok: true as const, ...v }
}
