import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ErrorCodes } from '@shitu/shared'
import { loadUserRows, upsertUserRow } from '@shitu/db'
import { getState, mutate, loadState, uid, nowIso } from './store.js'
import { getProfile, resetProfile, seedProfile, setActiveCar } from './profile.js'
import { createCareRun, createClaimRun, chooseClaim, getRun, decideRun } from './orchestrator.js'
import { nearbySearch, type NearbyKind } from './amap.js'
import { askAgent } from './ask.js'
import { seedUsers } from './admin.js'

/** 启动：载入/播种状态（loadState 内处理重启恢复语义；Turso 就绪） */
export async function initState() {
  return loadState(() => ({ profile: seedProfile(), runs: [], audit: [] }))
}

const err = (code: string, message: string, statusCode = 400) => ({ statusCode, code, message })

export async function registerRoutes(app: FastifyInstance) {
  /* ---------- 账号体系：手机号注册 / 登录（users 表直读写，注册校验走后端） ---------- */
  const PHONE_RE = /^1[3-9]\d{9}$/
  const ACCOUNT_RE = /^(1[3-9]\d{9}|[^@\s]+@[^@\s]+\.[^@\s]+)$/

  app.post('/api/auth/register', async (req, reply) => {
    const body = z
      .object({ account: z.string().regex(PHONE_RE, '手机号格式有误'), name: z.string().min(1).max(40) })
      .safeParse(req.body ?? {})
    if (!body.success) return reply.status(400).send(err('INVALID_BODY', '请输入正确的手机号和昵称'))
    const { account, name } = body.data
    await seedUsers()
    const rows = await loadUserRows()
    if (rows.some((u) => u.email === account))
      return reply.status(409).send(err('USER_EXISTS', '该手机号已注册，请直接登录'))
    const u = {
      id: uid('u'), email: account, name, role: 'user', status: 'active',
      created_at: nowIso(), last_login_at: nowIso(),
    }
    await upsertUserRow(u)
    mutate((s) => {
      s.audit.push({ at: nowIso(), actor: 'user', action: 'auth.register', detail: `新用户注册 ${account}` })
    })
    return reply.status(201).send({ ok: true, user: { account: u.email, name: u.name, role: u.role } })
  })

  app.post('/api/auth/login', async (req, reply) => {
    const body = z
      .object({ account: z.string().regex(ACCOUNT_RE, '账号格式有误') })
      .safeParse(req.body ?? {})
    if (!body.success) return reply.status(400).send(err('INVALID_BODY', '请输入正确的手机号或邮箱'))
    const { account } = body.data
    await seedUsers()
    const rows = await loadUserRows()
    const u = rows.find((r) => r.email === account)
    if (!u) return reply.status(404).send(err('USER_NOT_FOUND', '该账号尚未注册'))
    if (u.status !== 'active') return reply.status(403).send(err('USER_DISABLED', '该账号已被禁用，请联系管理员'))
    await upsertUserRow({ ...u, last_login_at: nowIso() })
    mutate((s) => {
      s.audit.push({ at: nowIso(), actor: 'user', action: 'auth.login', detail: `用户登录 ${account}` })
    })
    return { ok: true, user: { account: u.email, name: u.name, role: u.role } }
  })

  /* ---------- 任务闭环（care 场景） ---------- */
  const RunCreateSchema = z.object({
    scenario: z.literal('care').default('care'),
    inject: z.enum(['none', 'shop_timeout', 'llm_down']).default('none'),
  })

  app.post('/api/care/runs', async (req, reply) => {
    const parsed = RunCreateSchema.safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send(err(ErrorCodes.CAR_NOT_FOUND, 'INVALID_BODY'))
    const run = createCareRun(parsed.data.inject)
    return reply.status(201).send(run)
  })

  /* ---------- 理赔闭环（claim 场景） ---------- */
  const ClaimCreateSchema = z.object({
    scenario: z.literal('claim').default('claim'),
    inject: z.enum(['none', 'insurer_timeout', 'llm_down']).default('none'),
    /** 可选：车主上传的照片（data URL，仅内存中转用于识别，不落盘） */
    photo: z.string().max(4_000_000).optional(),
  })

  app.post('/api/claim/runs', async (req, reply) => {
    const parsed = ClaimCreateSchema.safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send(err('INVALID_BODY', 'invalid body'))
    const run = createClaimRun(parsed.data.inject, parsed.data.photo)
    return reply.status(201).send(run)
  })

  const ChooseSchema = z.object({ choice: z.enum(['self', 'claim']) })

  app.post('/api/runs/:id/choose', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = ChooseSchema.safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send(err('INVALID_BODY', 'choice required'))
    const r = chooseClaim(id, parsed.data.choice)
    if (!r.ok) {
      const map: Record<string, number> = { RUN_NOT_FOUND: 404, CHOICE_INVALID: 409 }
      return reply.status(map[r.error!] ?? 400).send(err(r.error!, r.error!))
    }
    return getRun(id)
  })

  app.get('/api/runs/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const run = getRun(id)
    if (!run) return reply.status(404).send(err('RUN_NOT_FOUND', 'run not found', 404))
    return run
  })

  const ConfirmSchema = z.object({ decision: z.enum(['approve', 'reject']), token: z.string().min(8) })

  app.post('/api/runs/:id/confirm', async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = ConfirmSchema.safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send(err('INVALID_BODY', 'decision/token required'))
    const r = decideRun(id, parsed.data.token, parsed.data.decision)
    if (!r.ok) {
      const map: Record<string, number> = {
        RUN_NOT_FOUND: 404, RUN_NOT_WAITING: 409, CONFIRM_NOT_FOUND: 409,
        CONFIRM_TOKEN_INVALID: 403, CONFIRM_EXPIRED: 410,
      }
      return reply.status(map[r.error!] ?? 400).send(err(r.error!, r.error!))
    }
    return getRun(id)
  })

  /* ---------- 档案（任务闭环的数据源与回写目标） ---------- */
  app.get('/api/profile', async () => getProfile())

  app.post('/api/profile/reset', async () => {
    resetProfile()
    return getProfile()
  })

  /* 车主建档：录入自己的车（覆盖演示样例，成为档案主车） */
  const CarCreateSchema = z.object({
    id: z.string().min(1).max(64),
    plateNo: z.string().min(1).max(16),
    brand: z.string().min(1).max(40),
    model: z.string().min(1).max(60),
    year: z.coerce.number().int().min(1980).max(2100),
    fuelType: z.string().min(1).max(10),
    purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mileage: z.coerce.number().int().min(0).max(2_000_000),
    mileageAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    insuranceExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    inspectionExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    lastMaintenanceMileage: z.coerce.number().int().min(0).max(2_000_000).optional(),
  })

  app.post('/api/profile/cars', async (req, reply) => {
    const parsed = CarCreateSchema.safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send(err('INVALID_BODY', '车辆信息不完整或格式有误'))
    setActiveCar(parsed.data)
    return getProfile()
  })

  /* ---------- 对话式入口（自然语言问诊：档案事实 + LLM 表达 + 规则兜底） ---------- */
  const AskSchema = z.object({ question: z.string().min(1).max(500) })

  app.post('/api/ask', async (req, reply) => {
    const parsed = AskSchema.safeParse(req.body ?? {})
    if (!parsed.success) return reply.status(400).send(err('INVALID_BODY', 'question required (1–500 字)'))
    const result = await askAgent(parsed.data.question, getProfile())
    // 审计留痕（actor=user：车主主动发起的问询）
    mutate((s) => {
      s.audit.push({
        at: new Date().toISOString(),
        actor: 'user',
        action: 'chat.ask',
        detail: `${parsed.data.question.slice(0, 40)}… → ${result.provider}`,
      })
    })
    return result
  })

  /* ---------- 地图工具（高德适配器：mock 默认 + AMAP_KEY 真实切换） ---------- */
  app.get('/api/tools/nearby', async (req, reply) => {
    const q = req.query as { kind?: string; lng?: string; lat?: string }
    if (q.kind !== 'charging' && q.kind !== 'gas' && q.kind !== 'wash')
      return reply.status(400).send(err('INVALID_KIND', 'kind must be charging|gas|wash'))
    const location = q.lng && q.lat ? `${q.lng},${q.lat}` : undefined
    return nearbySearch(q.kind as NearbyKind, location)
  })

  /* ---------- 审计（运行证据：复赛「输出结果可追溯」） ---------- */
  app.get('/api/audit', async () => {
    const s = getState()
    return { entries: [...s.audit].reverse().slice(0, 50), total: s.audit.length }
  })

  /* ---------- 指标看板（轻量管理后台的数据源） ---------- */
  app.get('/api/metrics', async () => {
    const s = getState()
    const byStatus: Record<string, number> = {}
    const byScenario: Record<string, number> = {}
    let degradedRuns = 0
    let durationTotal = 0
    let durationN = 0
    const tools = new Map<string, { calls: number; degraded: number; failed: number; latencyTotal: number; latencyN: number }>()
    const bump = (name: string) => {
      let t = tools.get(name)
      if (!t) tools.set(name, (t = { calls: 0, degraded: 0, failed: 0, latencyTotal: 0, latencyN: 0 }))
      return t
    }
    for (const r of s.runs) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
      byScenario[r.scenario] = (byScenario[r.scenario] ?? 0) + 1
      if (r.degradations.length) degradedRuns++
      if (r.finishedAt) {
        durationTotal += new Date(r.finishedAt).getTime() - new Date(r.createdAt).getTime()
        durationN++
      }
      for (const st of r.steps) {
        for (const t of st.tools ?? []) {
          const agg = bump(t.name)
          agg.calls++
          if (t.status === 'degraded') agg.degraded++
          if (t.status === 'failed') agg.failed++
          if (t.latencyMs !== undefined) {
            agg.latencyTotal += t.latencyMs
            agg.latencyN++
          }
        }
      }
    }
    const done = byStatus.done ?? 0
    const finished = done + (byStatus.failed ?? 0) + (byStatus.cancelled ?? 0)
    return {
      at: new Date().toISOString(),
      runs: {
        total: s.runs.length,
        byStatus,
        byScenario,
        degradedRuns,
        successRate: finished ? Math.round((done / finished) * 100) : null,
        avgDurationMs: durationN ? Math.round(durationTotal / durationN) : null,
      },
      profile: {
        cars: s.profile.cars.length,
        events: s.profile.cars.reduce((n, c) => n + c.events.length, 0),
        bookings: s.profile.bookings.length,
        remindersPending: s.profile.reminders.filter((r) => r.status === 'pending').length,
      },
      audit: { total: s.audit.length },
      tools: [...tools.entries()]
        .map(([name, t]) => ({
          name,
          calls: t.calls,
          degraded: t.degraded,
          failed: t.failed,
          avgLatencyMs: t.latencyN ? Math.round(t.latencyTotal / t.latencyN) : null,
        }))
        .sort((a, b) => b.calls - a.calls),
      providers: {
        llm: process.env.LLM_PROVIDER ?? 'rule',
        dashscopeKey: !!process.env.DASHSCOPE_API_KEY,
        amap: process.env.AMAP_KEY ? 'live' : 'demo',
        db: (process.env.DATABASE_URL ?? '').startsWith('libsql') ? 'turso' : 'local',
      },
    }
  })

  /* ---------- 演示辅助：当前运行列表 ---------- */
  app.get('/api/runs', async () => mutate((s) => ({ runs: s.runs.slice(0, 20) })))
}
