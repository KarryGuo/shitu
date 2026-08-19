import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { ErrorCodes } from '@shitu/shared'
import { getState, mutate, loadState } from './store.js'
import { getProfile, resetProfile, seedProfile } from './profile.js'
import { createCareRun, createClaimRun, chooseClaim, getRun, decideRun } from './orchestrator.js'
import { nearbySearch, type NearbyKind } from './amap.js'
import { askAgent } from './ask.js'

/** 启动：载入/播种状态（loadState 内处理重启恢复语义；Turso 就绪） */
export async function initState() {
  return loadState(() => ({ profile: seedProfile(), runs: [], audit: [] }))
}

const err = (code: string, message: string, statusCode = 400) => ({ statusCode, code, message })

export async function registerRoutes(app: FastifyInstance) {
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
