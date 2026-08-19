import type { RunDTO, AuditEntry, ProfileDTO } from '@shitu/shared'
import {
  ensureSchema, loadRunRows, loadAuditRows, loadProfileRows,
  upsertRunRow, insertAuditRows, replaceProfileRows,
} from '@shitu/db'

/**
 * 状态仓储（§0 原则 2「一切状态入库」）：
 * 内存缓存 + Turso（libSQL）写透 —— 与 JSON 落盘版接口语义一致：
 * 重启不丢、可恢复（waiting 可继续确认；running 标记 interrupted）。
 * 演示量级（≤50 runs / 单车主）下整域 upsert 足够；量大后按行 diff 优化。
 */

export interface PersistedState {
  profile: ProfileDTO
  runs: RunDTO[]
  audit: AuditEntry[]
}

/** 内部带 id 的审计条目（用于持久化水位跟踪） */
interface AuditEntryInternal extends AuditEntry {
  id: string
}

interface InternalState extends Omit<PersistedState, 'audit'> {
  audit: AuditEntryInternal[]
}

let state: InternalState
let hydrated: Promise<PersistedState> | null = null

/**
 * 内存容量：runs 新者在头（unshift），audit 新者在尾（push）。
 * 超限裁剪最旧数据（数据库保留全量，供管理后台查阅）；
 * 消费者侧接口另按 100 条上限返回（见 routes.ts）。
 */
const MAX_RUNS = 200
const MAX_AUDIT = 1000

export async function loadState(seed: () => PersistedState): Promise<PersistedState> {
  if (state) return state
  if (hydrated) return hydrated
  hydrated = (async () => {
    await ensureSchema()

    const [runRows, auditRows, profileRows] = await Promise.all([
      loadRunRows(MAX_RUNS), loadAuditRows(MAX_AUDIT), loadProfileRows(),
    ])

    const runs: RunDTO[] = runRows.map((r) => ({
      id: r.id,
      scenario: r.scenario as RunDTO['scenario'],
      status: r.status as RunDTO['status'],
      inject: r.inject as RunDTO['inject'],
      steps: JSON.parse(r.steps_json),
      degradations: JSON.parse(r.degradations_json),
      choice: (r.choice ?? undefined) as RunDTO['choice'],
      choicePending: !!r.choice_pending,
      createdAt: r.created_at,
      finishedAt: r.finished_at ?? undefined,
    }))
    // 恢复语义：执行中的运行标记中断（可重新发起）；等待确认的运行原样保留（仍可确认）
    for (const run of runs) {
      if (run.status === 'running') {
        run.status = 'interrupted'
        run.steps.push({
          seq: run.steps.length + 1,
          kind: 'error',
          seal: '断',
          title: '系统 · 服务重启',
          error: '运行因服务重启中断，任务未执行任何写操作，可重新发起。',
          at: new Date().toISOString(),
        })
      }
    }

    const audit: AuditEntryInternal[] = auditRows.map((r) => ({
      id: `a${r.seq}`,
      at: r.at,
      actor: r.actor as AuditEntry['actor'],
      action: r.action,
      detail: r.detail ?? undefined,
      runId: r.run_id ?? undefined,
    }))

    let profile: ProfileDTO
    if (profileRows.cars.length === 0) {
      profile = seed().profile
    } else {
      profile = {
        cars: profileRows.cars.map((c) => {
          const s = profileRows.states.find((x) => x.car_id === c.id)
          return {
            static: {
              id: c.id, plateNo: c.plate_no, brand: c.brand, model: c.model,
              year: c.year, fuelType: c.fuel_type, purchaseDate: c.purchase_date,
            },
            state: {
              mileage: s?.mileage ?? 0,
              mileageAt: s?.mileage_at ?? '',
              insuranceExpiry: s?.insurance_expiry ?? '',
              inspectionExpiry: s?.inspection_expiry ?? '',
              lastMaintenanceAt: s?.last_maintenance_at ?? undefined,
              lastMaintenanceMileage: s?.last_maintenance_mileage ?? undefined,
            },
            events: profileRows.events
              .filter((e) => e.car_id === c.id)
              .map((e) => ({ id: e.id, carId: e.car_id, type: e.type as never, occurredAt: e.occurred_at, title: e.title, detail: e.detail })),
          }
        }),
        reminders: profileRows.reminders.map((r) => ({
          id: r.id, carId: r.car_id, kind: r.kind as never, title: r.title, dueAt: r.due_at, status: r.status as never,
        })),
        bookings: profileRows.bookings.map((b) => ({
          id: b.id, carId: b.car_id, shopName: b.shop_name, startsAt: b.starts_at,
          items: b.items, priceEstimate: b.price_estimate, status: b.status as never,
        })),
      }
    }

    state = { profile, runs, audit }
    // 已从库中载入的审计条目计入水位，避免重启后重复插入
    for (const a of audit) persistedAuditIds.add(a.id)
    await flushAll()
    return state
  })()
  return hydrated
}

/** 同步取缓存态（须先 await loadState） */
export function getState(): PersistedState {
  return state
}

/* ---------- 写透：mutate 后防抖批量落库 ---------- */

let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushing = false
let pendingAgain = false
/** 已持久化的审计 id 集合（水位） */
const persistedAuditIds = new Set<string>()

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushAll()
  }, 40)
}

/** 全量写透：runs upsert + 新增审计 insert + 档案域整体替换 */
export async function flushAll(): Promise<void> {
  if (!state) return
  if (flushing) {
    pendingAgain = true
    return
  }
  flushing = true
  try {
    await Promise.all([flushRuns(), flushAudit(), flushProfile()])
  } catch (e) {
    // 落库失败不影响运行（内存态为准）；生产实现为重试队列
    console.error('[store] flush failed:', (e as Error).message)
  } finally {
    flushing = false
    if (pendingAgain) {
      pendingAgain = false
      scheduleFlush()
    }
  }
}

async function flushRuns() {
  for (const r of state.runs) {
    await upsertRunRow({
      id: r.id,
      scenario: r.scenario,
      status: r.status,
      inject: r.inject,
      steps_json: JSON.stringify(r.steps),
      degradations_json: JSON.stringify(r.degradations),
      choice: r.choice ?? null,
      choice_pending: r.choicePending ? 1 : 0,
      created_at: r.createdAt,
      finished_at: r.finishedAt ?? null,
    })
  }
}

async function flushAudit() {
  const fresh = state.audit.filter((a) => !persistedAuditIds.has(a.id))
  if (!fresh.length) return
  await insertAuditRows(
    // libsql 不接受 undefined：可空字段统一转 null
    fresh.map((a) => ({ at: a.at, actor: a.actor, action: a.action, detail: a.detail ?? null, run_id: a.runId ?? null })),
  )
  for (const a of fresh) persistedAuditIds.add(a.id)
}

async function flushProfile() {
  const p = state.profile
  await replaceProfileRows({
    cars: p.cars.map((c) => ({
      id: c.static.id, user_id: 'u1', plate_no: c.static.plateNo, brand: c.static.brand,
      model: c.static.model, year: c.static.year, fuel_type: c.static.fuelType,
      purchase_date: c.static.purchaseDate, created_at: c.static.purchaseDate,
    })),
    states: p.cars.map((c) => ({
      car_id: c.static.id, mileage: c.state.mileage, mileage_at: c.state.mileageAt,
      insurance_expiry: c.state.insuranceExpiry, inspection_expiry: c.state.inspectionExpiry,
      last_maintenance_at: c.state.lastMaintenanceAt ?? null,
      last_maintenance_mileage: c.state.lastMaintenanceMileage ?? null,
      updated_at: new Date().toISOString(),
    })),
    events: p.cars.flatMap((c) =>
      c.events.map((e) => ({ id: e.id, car_id: e.carId, type: e.type, occurred_at: e.occurredAt, title: e.title, detail: e.detail })),
    ),
    reminders: p.reminders.map((r) => ({ id: r.id, car_id: r.carId, kind: r.kind, title: r.title, due_at: r.dueAt, status: r.status })),
    bookings: p.bookings.map((b) => ({
      id: b.id, car_id: b.carId, shop_name: b.shopName, starts_at: b.startsAt,
      items: b.items, price_estimate: b.priceEstimate, status: b.status, idempotency_key: null,
    })),
  })
}

export function mutate<T>(fn: (s: PersistedState) => T): T {
  const r = fn(state)
  // 新增审计条目补 id（水位跟踪；数组头部裁剪不影响）
  for (const a of state.audit) if (!a.id) a.id = uid('a')
  // 容量裁剪：只保留最新数据（最旧记录仍在数据库，管理后台可查阅）
  if (state.runs.length > MAX_RUNS) state.runs = state.runs.slice(0, MAX_RUNS)
  if (state.audit.length > MAX_AUDIT) state.audit = state.audit.slice(-MAX_AUDIT)
  scheduleFlush()
  return r
}

export function nowIso() {
  return new Date().toISOString()
}

let seq = 0
export const uid = (p: string) => `${p}_${Date.now().toString(36)}${(++seq).toString(36)}`
