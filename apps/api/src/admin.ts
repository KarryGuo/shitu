/**
 * 管理后台（Admin Console）：
 * - 鉴权：x-admin-token 请求头，口令来自 ADMIN_TOKEN（未配置时默认演示口令，便于评审进入）
 * - 用户管理：users 表独立域（DB 直读直写），演示用户自动播种
 * - 车辆管理：跨用户车辆视图；编辑/删除走 store.mutate（内存态与 Turso 同步写透）
 * - 运营看板：用户/车辆/任务运行/LLM 调用聚合 + 近 7 日趋势
 * - 所有管理写操作入审计（actor=admin），与车主侧同一本账
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  ensureSchema, loadUserRows, upsertUserRow, deleteUserRow, countCarsByUser,
} from '@shitu/db'
import { getState, mutate } from './store.js'
import { uid, nowIso } from './store.js'

const DEMO_ADMIN_TOKEN = 'shitu-admin'

function adminToken(): string {
  return process.env.ADMIN_TOKEN || DEMO_ADMIN_TOKEN
}

function requireAdmin(req: FastifyRequest, reply: FastifyReply): boolean {
  if (req.headers['x-admin-token'] === adminToken()) return true
  reply.status(401).send({ statusCode: 401, code: 'ADMIN_UNAUTHORIZED', message: '管理口令无效' })
  return false
}

/** 审计留痕（actor=admin） */
function auditAdmin(action: string, detail: string) {
  mutate((s) => {
    s.audit.push({ at: nowIso(), actor: 'admin', action, detail })
  })
}

/** 播种演示用户（首访时） */
let usersSeeded = false
async function seedUsers() {
  if (usersSeeded) return
  await ensureSchema()
  const rows = await loadUserRows()
  if (rows.length === 0) {
    const t = nowIso()
    await upsertUserRow({ id: 'u1', email: 'owner@shitu.app', name: '演示车主', role: 'user', status: 'active', created_at: t, last_login_at: t })
    await upsertUserRow({ id: 'u0', email: 'admin@shitu.app', name: '管理员', role: 'admin', status: 'active', created_at: t, last_login_at: null })
  }
  usersSeeded = true
}

export async function registerAdminRoutes(app: FastifyInstance) {
  /* ---------- 口令校验（前端登录门） ---------- */
  app.post('/api/admin/login', async (req, reply) => {
    const body = z.object({ token: z.string().min(1) }).safeParse(req.body ?? {})
    if (!body.success) return reply.status(400).send({ statusCode: 400, code: 'INVALID_BODY', message: 'token required' })
    if (body.data.token !== adminToken())
      return reply.status(401).send({ statusCode: 401, code: 'ADMIN_UNAUTHORIZED', message: '管理口令无效' })
    await seedUsers()
    return { ok: true, demoDefault: !process.env.ADMIN_TOKEN }
  })

  /* ---------- 运营看板 ---------- */
  app.get('/api/admin/overview', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    await seedUsers()
    const [users, carCounts] = await Promise.all([loadUserRows(), countCarsByUser()])
    const s = getState()

    const byStatus: Record<string, number> = {}
    const byScenario: Record<string, number> = {}
    let degradedRuns = 0
    const llmCalls = { total: 0, degraded: 0 }
    // 近 7 日趋势（按天聚合）
    const days: { date: string; runs: number; done: number; degraded: number }[] = []
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      days.push({ date: d.toISOString().slice(0, 10), runs: 0, done: 0, degraded: 0 })
    }
    const dayMap = new Map(days.map((d) => [d.date, d]))

    for (const r of s.runs) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
      byScenario[r.scenario] = (byScenario[r.scenario] ?? 0) + 1
      if (r.degradations.length) degradedRuns++
      const day = dayMap.get(r.createdAt.slice(0, 10))
      if (day) {
        day.runs++
        if (r.status === 'done') day.done++
        if (r.degradations.length) day.degraded++
      }
      for (const st of r.steps) {
        for (const t of st.tools ?? []) {
          if (t.name.includes('llm') || t.name.includes('qwen') || t.name.includes('vl')) {
            llmCalls.total++
            if (t.status === 'degraded') llmCalls.degraded++
          }
        }
      }
    }
    const done = byStatus.done ?? 0
    const finished = done + (byStatus.failed ?? 0) + (byStatus.cancelled ?? 0)
    const totalCars = s.profile.cars.length

    return {
      at: nowIso(),
      users: {
        total: users.length,
        active: users.filter((u) => u.status === 'active').length,
        disabled: users.filter((u) => u.status === 'disabled').length,
        admins: users.filter((u) => u.role === 'admin').length,
      },
      cars: { total: totalCars, events: s.profile.cars.reduce((n, c) => n + c.events.length, 0), bookings: s.profile.bookings.length, byUser: carCounts },
      runs: {
        total: s.runs.length,
        byStatus,
        byScenario,
        degradedRuns,
        successRate: finished ? Math.round((done / finished) * 100) : null,
      },
      llm: { ...llmCalls, provider: process.env.LLM_PROVIDER ?? 'rule', keyConfigured: !!process.env.DASHSCOPE_API_KEY },
      trend: days,
      auditTotal: s.audit.length,
    }
  })

  /* ---------- 用户管理 ---------- */
  app.get('/api/admin/users', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    await seedUsers()
    const [rows, carCounts] = await Promise.all([loadUserRows(), countCarsByUser()])
    return { users: rows.map((u) => ({ ...u, cars: carCounts[u.id] ?? 0 })) }
  })

  app.post('/api/admin/users', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const body = z.object({
      email: z.string().email(),
      name: z.string().min(1).max(40),
      role: z.enum(['user', 'admin']).default('user'),
    }).safeParse(req.body ?? {})
    if (!body.success) return reply.status(400).send({ statusCode: 400, code: 'INVALID_BODY', message: 'email/name/role required' })
    const { email, name, role } = body.data
    const existing = await loadUserRows()
    if (existing.some((u) => u.email === email))
      return reply.status(409).send({ statusCode: 409, code: 'EMAIL_EXISTS', message: '邮箱已存在' })
    const u = { id: uid('u'), email, name, role, status: 'active', created_at: nowIso(), last_login_at: null }
    await upsertUserRow(u)
    auditAdmin('admin.user.create', `创建用户 ${email}（${role}）`)
    return reply.status(201).send(u)
  })

  app.patch('/api/admin/users/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const { id } = req.params as { id: string }
    const body = z.object({
      status: z.enum(['active', 'disabled']).optional(),
      role: z.enum(['user', 'admin']).optional(),
      name: z.string().min(1).max(40).optional(),
    }).safeParse(req.body ?? {})
    if (!body.success) return reply.status(400).send({ statusCode: 400, code: 'INVALID_BODY', message: 'status/role/name' })
    const rows = await loadUserRows()
    const u = rows.find((x) => x.id === id)
    if (!u) return reply.status(404).send({ statusCode: 404, code: 'USER_NOT_FOUND', message: '用户不存在' })
    const next = { ...u, ...body.data }
    await upsertUserRow(next)
    const changes = Object.entries(body.data).map(([k, v]) => `${k}=${v}`).join(', ')
    auditAdmin('admin.user.update', `用户 ${u.email}：${changes}`)
    return next
  })

  app.delete('/api/admin/users/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const { id } = req.params as { id: string }
    const rows = await loadUserRows()
    const u = rows.find((x) => x.id === id)
    if (!u) return reply.status(404).send({ statusCode: 404, code: 'USER_NOT_FOUND', message: '用户不存在' })
    const carCounts = await countCarsByUser()
    if ((carCounts[id] ?? 0) > 0)
      return reply.status(409).send({ statusCode: 409, code: 'USER_HAS_CARS', message: '用户名下仍有车辆，请先处理车辆' })
    await deleteUserRow(id)
    auditAdmin('admin.user.delete', `删除用户 ${u.email}`)
    return { ok: true }
  })

  /* ---------- 车辆管理（跨用户；内存态与 Turso 同步写透） ---------- */
  app.get('/api/admin/cars', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    await seedUsers()
    const s = getState()
    const users = await loadUserRows()
    const userName = new Map(users.map((u) => [u.id, u.name]))
    return {
      cars: s.profile.cars.map((c) => ({
        id: c.static.id,
        plateNo: c.static.plateNo,
        brand: c.static.brand,
        model: c.static.model,
        year: c.static.year,
        fuelType: c.static.fuelType,
        mileage: c.state.mileage,
        insuranceExpiry: c.state.insuranceExpiry,
        inspectionExpiry: c.state.inspectionExpiry,
        owner: userName.get('u1') ?? '演示车主',
        events: c.events.length,
      })),
    }
  })

  app.patch('/api/admin/cars/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const { id } = req.params as { id: string }
    const body = z.object({
      mileage: z.number().int().min(0).max(2_000_000).optional(),
      insuranceExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      inspectionExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).safeParse(req.body ?? {})
    if (!body.success) return reply.status(400).send({ statusCode: 400, code: 'INVALID_BODY', message: 'mileage/insuranceExpiry/inspectionExpiry' })
    const s = getState()
    const car = s.profile.cars.find((c) => c.static.id === id)
    if (!car) return reply.status(404).send({ statusCode: 404, code: 'CAR_NOT_FOUND', message: '车辆不存在' })
    const changes = Object.entries(body.data).map(([k, v]) => `${k}=${v}`).join(', ')
    mutate((st) => {
      const c = st.profile.cars.find((x) => x.static.id === id)!
      if (body.data.mileage !== undefined) c.state.mileage = body.data.mileage
      if (body.data.insuranceExpiry !== undefined) c.state.insuranceExpiry = body.data.insuranceExpiry
      if (body.data.inspectionExpiry !== undefined) c.state.inspectionExpiry = body.data.inspectionExpiry
    })
    auditAdmin('admin.car.update', `车辆 ${car.static.plateNo}：${changes}`)
    return { ok: true }
  })

  app.delete('/api/admin/cars/:id', async (req, reply) => {
    if (!requireAdmin(req, reply)) return
    const { id } = req.params as { id: string }
    const s = getState()
    const car = s.profile.cars.find((c) => c.static.id === id)
    if (!car) return reply.status(404).send({ statusCode: 404, code: 'CAR_NOT_FOUND', message: '车辆不存在' })
    mutate((st) => {
      st.profile.cars = st.profile.cars.filter((c) => c.static.id !== id)
      st.profile.reminders = st.profile.reminders.filter((r) => r.carId !== id)
      st.profile.bookings = st.profile.bookings.filter((b) => b.carId !== id)
    })
    auditAdmin('admin.car.delete', `删除车辆 ${car.static.plateNo}（级联清理提醒与预约）`)
    return { ok: true }
  })
}
