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

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(URL(path), {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
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
  getNearby: (kind: 'charging' | 'gas' | 'wash') =>
    req<NearbyResult>(`/tools/nearby?kind=${kind}`),
  getMetrics: () => req<Metrics>('/metrics'),
  getAudit: () => req<AuditFeed>('/audit'),
  getRuns: () => req<{ runs: RunDTO[] }>('/runs'),
  ask: (question: string) =>
    req<AskResult>('/ask', { method: 'POST', body: JSON.stringify({ question }) }),
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
  providers: { llm: string; dashscopeKey: boolean; amap: string; db: string }
}

/** 审计日志（/api/audit） */
export interface AuditFeed {
  entries: { at: string; actor: 'agent' | 'user' | 'system' | 'admin'; action: string; detail?: string; runId?: string }[]
  total: number
}
