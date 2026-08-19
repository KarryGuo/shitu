/**
 * Turso（libSQL）客户端（架构 §1/§4）：
 * - DATABASE_URL=libsql://xxx.turso.io（生产，配合 TURSO_AUTH_TOKEN）
 * - DATABASE_URL=file:./data/shitu.db（本地开发）/ :memory:（测试）
 * DDL 显式可审查、幂等（CREATE IF NOT EXISTS），启动时执行；
 * Drizzle/drizzle-kit 预留为后续类型化查询升级路径。
 */
import { mkdirSync } from 'node:fs'
import { createClient, type Client, type InValue } from '@libsql/client'

/** 架构 §4.1 表结构（幂等 DDL，单一来源） */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS cars (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'u1',
  plate_no TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  fuel_type TEXT NOT NULL,
  purchase_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS car_states (
  car_id TEXT PRIMARY KEY REFERENCES cars(id),
  mileage INTEGER NOT NULL,
  mileage_at TEXT NOT NULL,
  insurance_expiry TEXT NOT NULL,
  inspection_expiry TEXT NOT NULL,
  last_maintenance_at TEXT,
  last_maintenance_mileage INTEGER,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS car_events (
  id TEXT PRIMARY KEY,
  car_id TEXT NOT NULL REFERENCES cars(id),
  type TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_car_events ON car_events(car_id, occurred_at DESC);
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  car_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  due_at TEXT NOT NULL,
  status TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status, due_at);
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  car_id TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  items TEXT NOT NULL,
  price_estimate TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT UNIQUE
);
CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  scenario TEXT NOT NULL,
  status TEXT NOT NULL,
  inject TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  degradations_json TEXT NOT NULL DEFAULT '[]',
  choice TEXT,
  choice_pending INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_created ON agent_runs(created_at DESC);
CREATE TABLE IF NOT EXISTS audit_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT,
  run_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_run ON audit_log(run_id);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  last_login_at TEXT
);
`

let client: Client | null = null

export function getDb(): Client {
  if (client) return client
  const url = process.env.DATABASE_URL ?? 'file:./data/shitu.db'
  // 本地文件库：目录可能不存在（相对 cwd 解析），自动创建，任何启动目录都可用
  if (url.startsWith('file:') && url !== 'file::memory:' && !url.includes(':memory:')) {
    const path = url.slice('file:'.length)
    if (path && !/[a-zA-Z]:[\\/]/.test(path)) {
      const dir = path.replace(/[/\\][^/\\]*$/, '')
      if (dir && dir !== path) mkdirSync(dir, { recursive: true })
    }
  }
  client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined })
  return client
}

/** 幂等建表（启动执行一次） */
export async function ensureSchema(): Promise<void> {
  const db = getDb()
  for (const stmt of SCHEMA_SQL.split(';')) {
    const sql = stmt.trim()
    if (sql) await db.execute(sql)
  }
}

/* ---------- 行类型（与 @shitu/shared 域模型一一对应） ---------- */

export interface RunRow {
  id: string
  scenario: string
  status: string
  inject: string
  steps_json: string
  degradations_json: string
  choice: string | null
  choice_pending: number
  created_at: string
  finished_at: string | null
}

export interface AuditRow {
  seq: number
  at: string
  actor: string
  action: string
  detail: string | null
  run_id: string | null
}

export interface CarRow {
  id: string
  user_id: string
  plate_no: string
  brand: string
  model: string
  year: number
  fuel_type: string
  purchase_date: string
  created_at: string
}

export interface CarStateRow {
  car_id: string
  mileage: number
  mileage_at: string
  insurance_expiry: string
  inspection_expiry: string
  last_maintenance_at: string | null
  last_maintenance_mileage: number | null
  updated_at: string
}

export interface CarEventRow {
  id: string
  car_id: string
  type: string
  occurred_at: string
  title: string
  detail: string
}

export interface ReminderRow {
  id: string
  car_id: string
  kind: string
  title: string
  due_at: string
  status: string
}

export interface BookingRow {
  id: string
  car_id: string
  shop_name: string
  starts_at: string
  items: string
  price_estimate: string
  status: string
  idempotency_key: string | null
}

export interface UserRow {
  id: string
  email: string
  name: string
  role: string
  status: string
  created_at: string
  last_login_at: string | null
}

/* ---------- 读取 ---------- */

export async function loadRunRows(limit = 50): Promise<RunRow[]> {
  const rs = await getDb().execute({
    sql: 'SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT ?',
    args: [limit],
  })
  return rs.rows as unknown as RunRow[]
}

export async function loadAuditRows(limit = 200): Promise<AuditRow[]> {
  const rs = await getDb().execute(
    `SELECT * FROM audit_log ORDER BY seq DESC LIMIT ${Number(limit)}`,
  )
  return (rs.rows as unknown as AuditRow[]).reverse()
}

export async function loadProfileRows() {
  const db = getDb()
  const [cars, states, events, reminders, bookings] = await Promise.all([
    db.execute('SELECT * FROM cars'),
    db.execute('SELECT * FROM car_states'),
    db.execute('SELECT * FROM car_events ORDER BY occurred_at DESC'),
    db.execute('SELECT * FROM reminders'),
    db.execute('SELECT * FROM bookings'),
  ])
  return {
    cars: cars.rows as unknown as CarRow[],
    states: states.rows as unknown as CarStateRow[],
    events: events.rows as unknown as CarEventRow[],
    reminders: reminders.rows as unknown as ReminderRow[],
    bookings: bookings.rows as unknown as BookingRow[],
  }
}

/* ---------- 用户域（管理后台）：独立于档案内存态，直接 DB 读写 ---------- */

export async function loadUserRows(): Promise<UserRow[]> {
  const rs = await getDb().execute('SELECT * FROM users ORDER BY created_at ASC')
  return rs.rows as unknown as UserRow[]
}

export async function upsertUserRow(u: UserRow): Promise<void> {
  await getDb().execute({
    sql: `INSERT INTO users (id, email, name, role, status, created_at, last_login_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET email=excluded.email, name=excluded.name,
        role=excluded.role, status=excluded.status, last_login_at=excluded.last_login_at`,
    args: [u.id, u.email, u.name, u.role, u.status, u.created_at, u.last_login_at] as InValue[],
  })
}

export async function deleteUserRow(id: string): Promise<void> {
  await getDb().execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] })
}

/** 各用户名下车辆数（管理后台用户列表列） */
export async function countCarsByUser(): Promise<Record<string, number>> {
  const rs = await getDb().execute('SELECT user_id, COUNT(*) AS n FROM cars GROUP BY user_id')
  const out: Record<string, number> = {}
  for (const row of rs.rows as unknown as { user_id: string; n: number }[]) out[row.user_id] = row.n
  return out
}

/* ---------- 写入 ---------- */

/** upsert 单条 agent_run（steps 以 JSON 存档；≤50 行，演示量级整体替换安全） */
export async function upsertRunRow(r: RunRow): Promise<void> {
  await getDb().execute({
    sql: `INSERT OR REPLACE INTO agent_runs
      (id, scenario, status, inject, steps_json, degradations_json, choice, choice_pending, created_at, finished_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      r.id, r.scenario, r.status, r.inject, r.steps_json, r.degradations_json,
      r.choice, r.choice_pending, r.created_at, r.finished_at,
    ] as InValue[],
  })
}

export async function insertAuditRows(rows: Omit<AuditRow, 'seq'>[]): Promise<void> {
  if (!rows.length) return
  const db = getDb()
  const stmts = rows.map((r) => ({
    sql: 'INSERT INTO audit_log (at, actor, action, detail, run_id) VALUES (?, ?, ?, ?, ?)',
    args: [r.at, r.actor, r.action, r.detail, r.run_id] as InValue[],
  }))
  await db.batch(stmts, 'write')
}

/** 档案域整体替换（演示量级：单车主数行，单批原子写） */
export async function replaceProfileRows(p: {
  cars: CarRow[]
  states: CarStateRow[]
  events: CarEventRow[]
  reminders: ReminderRow[]
  bookings: BookingRow[]
}): Promise<void> {
  const db = getDb()
  const stmts: { sql: string; args: InValue[] }[] = [
    { sql: 'DELETE FROM car_events', args: [] },
    { sql: 'DELETE FROM reminders', args: [] },
    { sql: 'DELETE FROM bookings', args: [] },
    { sql: 'DELETE FROM car_states', args: [] },
    { sql: 'DELETE FROM cars', args: [] },
  ]
  for (const c of p.cars)
    stmts.push({
      sql: `INSERT INTO cars (id, user_id, plate_no, brand, model, year, fuel_type, purchase_date, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [c.id, c.user_id, c.plate_no, c.brand, c.model, c.year, c.fuel_type, c.purchase_date, c.created_at] as InValue[],
    })
  for (const s of p.states)
    stmts.push({
      sql: `INSERT INTO car_states (car_id, mileage, mileage_at, insurance_expiry, inspection_expiry, last_maintenance_at, last_maintenance_mileage, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [s.car_id, s.mileage, s.mileage_at, s.insurance_expiry, s.inspection_expiry, s.last_maintenance_at, s.last_maintenance_mileage, s.updated_at] as InValue[],
    })
  for (const e of p.events)
    stmts.push({
      sql: 'INSERT INTO car_events (id, car_id, type, occurred_at, title, detail) VALUES (?, ?, ?, ?, ?, ?)',
      args: [e.id, e.car_id, e.type, e.occurred_at, e.title, e.detail] as InValue[],
    })
  for (const r of p.reminders)
    stmts.push({
      sql: 'INSERT INTO reminders (id, car_id, kind, title, due_at, status) VALUES (?, ?, ?, ?, ?, ?)',
      args: [r.id, r.car_id, r.kind, r.title, r.due_at, r.status] as InValue[],
    })
  for (const b of p.bookings)
    stmts.push({
      sql: `INSERT INTO bookings (id, car_id, shop_name, starts_at, items, price_estimate, status, idempotency_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [b.id, b.car_id, b.shop_name, b.starts_at, b.items, b.price_estimate, b.status, b.idempotency_key] as InValue[],
    })
  await db.batch(stmts as { sql: string; args: InValue[] }[], 'write')
}
