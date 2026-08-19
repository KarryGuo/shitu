import type { RunDTO, InjectMode, ProfileDTO } from '@shitu/shared'

/** 高德适配器返回（/api/tools/nearby） */
export interface NearbyResult {
  kind: 'charging' | 'gas' | 'wash'
  source: 'live' | 'sim'
  provider: string
  degraded: boolean
  note?: string
  pois: { name: string; address: string; distance: string; tag: string; location: string; nav: string }[]
}

/** 定位结果（/api/tools/locate）：gps=浏览器精准定位；ip=网络定位（城市级）；default=兜底默认位置 */
export interface LocateResult {
  source: 'gps' | 'ip' | 'default'
  location: string
  address: string
  note?: string
}

/**
 * API client：dev 经 vite 代理到 localhost:8787；生产同源（或 VITE_API_BASE 指向 api 服务）。
 */
const BASE = import.meta.env.VITE_API_BASE ?? '/api'
const URL = (p: string) => `${BASE}${p}`

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message)
  }
}

async function fetchOnce(path: string, init?: RequestInit): Promise<Response> {
  return fetch(URL(path), {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

/**
 * 统一请求：网络级失败（连接被关闭/断网/休眠实例冷启动）自动重试一次，
 * 缓解免费托管实例休眠后首个请求 ERR_CONNECTION_CLOSED 的问题。
 */
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetchOnce(path, init)
  } catch {
    // 冷启动/瞬时断连：稍候重试一次
    await new Promise((r) => setTimeout(r, 800))
    try {
      res = await fetchOnce(path, init)
    } catch {
      throw new ApiError('NETWORK_ERROR', `无法连接服务：${path}`, 0)
    }
  }
  if (!res.ok) {
    let code = `HTTP_${res.status}`
    try {
      const j = (await res.json()) as { code?: string }
      if (j.code) code = j.code
    } catch {
      /* ignore */
    }
    throw new ApiError(code, `请求失败：${path}`, res.status)
  }
  return (await res.json()) as T
}

/* ---------- 账号体系（注册/登录校验走后端 users 表） ---------- */

export interface AuthUser {
  account: string
  name: string
  role: string
}

export const authApi = {
  /** 登录：后端校验账号是否已注册（USER_NOT_FOUND / USER_DISABLED 有明确 code） */
  login: (account: string) =>
    req<{ ok: true; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ account }),
    }),
  /** 注册：手机号 + 昵称，409 = 已注册 */
  register: (account: string, name: string) =>
    req<{ ok: true; user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ account, name }),
    }),
}

export const api = {
  createCareRun: (inject: InjectMode) =>
    req<RunDTO>('/care/runs', { method: 'POST', body: JSON.stringify({ scenario: 'care', inject }) }),
  createClaimRun: (inject: InjectMode, photo?: string) =>
    req<RunDTO>('/claim/runs', { method: 'POST', body: JSON.stringify({ scenario: 'claim', inject, photo }) }),
  chooseRun: (id: string, choice: 'self' | 'claim') =>
    req<RunDTO>(`/runs/${id}/choose`, { method: 'POST', body: JSON.stringify({ choice }) }),
  getRun: (id: string) => req<RunDTO>(`/runs/${id}`),
  confirmRun: (id: string, token: string, decision: 'approve' | 'reject') =>
    req<RunDTO>(`/runs/${id}/confirm`, { method: 'POST', body: JSON.stringify({ decision, token }) }),
  getProfile: () => req<ProfileDTO>('/profile'),
  resetProfile: () => req<ProfileDTO>('/profile/reset', { method: 'POST' }),
  /** 车主建档：录入自己的车（成为后端档案主车，任务闭环/问识途基于它工作） */
  addCar: (body: {
    id: string
    plateNo: string
    brand: string
    model: string
    year: number
    fuelType: string
    purchaseDate: string
    mileage: number
    mileageAt: string
    insuranceExpiry: string
    inspectionExpiry: string
    lastMaintenanceMileage?: number
  }) => req<ProfileDTO>('/profile/cars', { method: 'POST', body: JSON.stringify(body) }),
  getNearby: (kind: 'charging' | 'gas' | 'wash', location?: string) => {
    const qs = new URLSearchParams({ kind })
    if (location) {
      const [lng, lat] = location.split(',')
      if (lng && lat) {
        qs.set('lng', lng)
        qs.set('lat', lat)
      }
    }
    return req<NearbyResult>(`/tools/nearby?${qs}`)
  },
  /** 定位：传浏览器坐标（已转 GCJ-02）得精准定位+逆地理地址；不传则按网络 IP 定位 */
  locate: (lng?: number, lat?: number) =>
    req<LocateResult>(`/tools/locate${lng !== undefined && lat !== undefined ? `?lng=${lng}&lat=${lat}` : ''}`),
  getMetrics: () => req<Metrics>('/metrics'),
  getAudit: () => req<AuditFeed>('/audit'),
  getRuns: () => req<{ runs: RunDTO[] }>('/runs'),
  ask: (question: string) =>
    req<AskResult>('/ask', { method: 'POST', body: JSON.stringify({ question }) }),
}

/** 静态地图 URL（/api/tools/map 图片代理：Key 留在服务端）：用户位置（红）+ 周边 POI（蓝）标注 */
export function mapUrl(center: string, pois: string[], zoom = 14): string {
  const qs = new URLSearchParams({ center, zoom: String(zoom) })
  if (pois.length) qs.set('pois', pois.join('|'))
  return URL(`/tools/map?${qs}`)
}

/* ---------- 管理后台（x-admin-token 鉴权） ---------- */

const ADMIN_TOKEN_KEY = 'shitu_admin_token'

async function adminReq<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(URL(path), {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-admin-token': localStorage.getItem(ADMIN_TOKEN_KEY) ?? '',
    },
  })
  if (!res.ok) {
    let code = `HTTP_${res.status}`
    try {
      const j = (await res.json()) as { code?: string; message?: string }
      if (j.code) code = j.code
      if (code === 'ADMIN_UNAUTHORIZED') localStorage.removeItem(ADMIN_TOKEN_KEY)
      throw new ApiError(code, j.message ?? `请求失败：${path}`, res.status)
    } catch (e) {
      if (e instanceof ApiError) throw e
      throw new ApiError(code, `请求失败：${path}`, res.status)
    }
  }
  return (await res.json()) as T
}

export const adminApi = {
  login: async (token: string) => {
    localStorage.setItem(ADMIN_TOKEN_KEY, token)
    try {
      const r = await req<{ ok: boolean; demoDefault: boolean }>('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
      return r
    } catch (e) {
      localStorage.removeItem(ADMIN_TOKEN_KEY)
      throw e
    }
  },
  logout: () => localStorage.removeItem(ADMIN_TOKEN_KEY),
  hasToken: () => !!localStorage.getItem(ADMIN_TOKEN_KEY),
  overview: () => adminReq<AdminOverview>('/admin/overview'),
  listUsers: () => adminReq<{ users: AdminUser[] }>('/admin/users'),
  createUser: (body: { email: string; name: string; role: 'user' | 'admin' }) =>
    adminReq<AdminUser>('/admin/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: string, body: { status?: 'active' | 'disabled'; role?: 'user' | 'admin'; name?: string }) =>
    adminReq<AdminUser>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteUser: (id: string) => adminReq<{ ok: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }),
  listCars: () => adminReq<{ cars: AdminCar[] }>('/admin/cars'),
  updateCar: (id: string, body: { mileage?: number; insuranceExpiry?: string; inspectionExpiry?: string }) =>
    adminReq<{ ok: boolean }>(`/admin/cars/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteCar: (id: string) => adminReq<{ ok: boolean }>(`/admin/cars/${id}`, { method: 'DELETE' }),
  /** 运行审计（全量查阅：直查数据库，可翻阅比消费者侧更早的历史） */
  listRuns: () => adminReq<{ total: number; runs: AdminRunSummary[] }>('/admin/runs'),
  listAudit: () => adminReq<{ total: number; entries: AuditFeed['entries'] }>('/admin/audit'),
}

export interface AdminOverview {
  at: string
  users: { total: number; active: number; disabled: number; admins: number }
  cars: { total: number; events: number; bookings: number; byUser: Record<string, number> }
  runs: {
    total: number
    byStatus: Record<string, number>
    byScenario: Record<string, number>
    degradedRuns: number
    successRate: number | null
  }
  llm: { total: number; degraded: number; provider: string; keyConfigured: boolean }
  tools: { name: string; calls: number; degraded: number; failed: number }[]
  trend: { date: string; runs: number; done: number; degraded: number }[]
  auditTotal: number
}

export interface AdminUser {
  id: string
  email: string
  name: string
  role: 'user' | 'admin' | string
  status: 'active' | 'disabled' | string
  created_at: string
  last_login_at: string | null
  cars: number
}

export interface AdminCar {
  id: string
  plateNo: string
  brand: string
  model: string
  year: number
  fuelType: string
  mileage: number
  insuranceExpiry: string
  inspectionExpiry: string
  owner: string
  events: number
}

/** 对话式问诊（POST /api/ask） */
export interface AskResult {
  text: string
  provider: string
  degraded: boolean
  note?: string
  actions: { kind: 'care' | 'claim' | 'profile'; label: string }[]
  facts: string[]
}

/** 指标看板（/api/metrics） */
export interface Metrics {
  at: string
  runs: {
    total: number
    byStatus: Record<string, number>
    byScenario: Record<string, number>
    degradedRuns: number
    successRate: number | null
    avgDurationMs: number | null
  }
  profile: { cars: number; events: number; bookings: number; remindersPending: number }
  audit: { total: number }
  tools: { name: string; calls: number; degraded: number; failed: number; avgLatencyMs: number | null }[]
  /** 逐次工具调用记录（新者在前，仅最新 100 条；更早在管理后台查阅） */
  toolCalls: { at: string; runId: string; scenario: string; name: string; status: string; latencyMs: number | null; note?: string }[]
  providers: { llm: string; dashscopeKey: boolean; amap: string; db: string }
}

/** 管理后台运行摘要（/api/admin/runs，全量） */
export interface AdminRunSummary {
  id: string
  scenario: string
  status: string
  inject: string
  steps: number
  degradations: number
  createdAt: string
  finishedAt: string | null
}

/** 审计日志（/api/audit） */
export interface AuditFeed {
  entries: { at: string; actor: 'agent' | 'user' | 'system' | 'admin'; action: string; detail?: string; runId?: string }[]
  total: number
}
