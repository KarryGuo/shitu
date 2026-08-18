/**
 * 数据库巡检：node packages/db/scripts/db-check.mjs [db-path]
 * 默认读 apps/api/data/shitu.db（本地开发库）；生产传 Turso URL + TURSO_AUTH_TOKEN。
 */
import { createClient } from '@libsql/client'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const url = process.argv[2] ?? `file:${path.join(root, 'apps', 'api', 'data', 'shitu.db')}`
const c = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined })

const q = async (sql) => (await c.execute(sql)).rows[0]
console.log(`db: ${url}`)
console.log('cars       =', (await q('SELECT COUNT(*) n FROM cars')).n)
console.log('car_states =', (await q('SELECT COUNT(*) n FROM car_states')).n)
console.log('car_events =', (await q('SELECT COUNT(*) n FROM car_events')).n)
console.log('reminders  =', (await q('SELECT COUNT(*) n FROM reminders')).n)
console.log('bookings   =', (await q('SELECT COUNT(*) n FROM bookings')).n)
console.log('agent_runs =', (await q('SELECT COUNT(*) n FROM agent_runs')).n)
console.log('audit_log  =', (await q('SELECT COUNT(*) n FROM audit_log')).n)
const runs = await c.execute('SELECT id, scenario, status, created_at FROM agent_runs ORDER BY created_at DESC LIMIT 5')
for (const r of runs.rows) console.log(`  ${r.id} ${r.scenario} ${r.status} ${r.created_at}`)
const audit = await c.execute('SELECT actor, action, COUNT(*) n FROM audit_log GROUP BY actor, action ORDER BY n DESC LIMIT 8')
for (const r of audit.rows) console.log(`  audit ${r.actor} ${r.action} x${r.n}`)
