/**
 * eval runner（复赛运行证据，架构 §12）：
 * 用法：pnpm eval
 * 读取 evals/cases/*.json → 逐用例执行（内存库 + 规则 LLM + 全速）
 * → 生成 evals/report/report.json + report.md
 * 全部通过退出码 0，否则 1（可直接接入 CI）。
 */
import './env.js'
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadState, mutate, flushAll } from '../apps/api/src/store.js'
import { seedProfile, getProfile } from '../apps/api/src/profile.js'
import { createCareRun, createClaimRun, getRun, decideRun, chooseClaim } from '../apps/api/src/orchestrator.js'

/* ---------------- 用例 schema（与 cases/*.json 一一对应） ---------------- */

interface EvalAction {
  type: 'wait' | 'confirm' | 'choose'
  /** wait: 轮询直到 run.status 达到该状态 */
  status?: string
  /** wait: 轮询直到确认单步骤出现 */
  confirm?: boolean
  /** confirm: 车主决策 */
  decision?: 'approve' | 'reject'
  /** choose: 理赔车主选择（自费/走保险） */
  choice?: 'self' | 'claim'
}

interface EvalExpect {
  finalStatus?: string
  includesSteps?: string[]
  excludesSteps?: string[]
  /** 指定步骤的 degraded 标记必须为该值 */
  stepDegraded?: Record<string, boolean>
  runDegraded?: boolean
  bookingsDelta?: number
  eventsDelta?: number
  /** decideRun/chooseClaim 应返回的错误码 */
  decideError?: string
  /** 任一步骤标题包含该字符串 */
  titleContains?: string
}

interface EvalCase {
  id: string
  name: string
  scenario: 'care' | 'claim'
  inject: string
  ttl?: number
  actions: EvalAction[]
  expect: EvalExpect
}

interface StepSummary {
  seq: number
  kind: string
  title: string
  degraded: boolean
}

interface CaseResult {
  id: string
  name: string
  scenario: string
  inject: string
  passed: boolean
  failures: string[]
  durationMs: number
  runId: string
  finalStatus: string
  steps: StepSummary[]
  degradations: string[]
  deltas: { bookings: number; events: number }
}

const HERE = dirname(fileURLToPath(import.meta.url))
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function resetWorld() {
  // 用例隔离：清空运行域 + 档案域回到种子（内存库，不污染任何真实数据）
  mutate((s) => {
    s.runs = []
    s.audit = []
    s.profile = seedProfile()
  })
}

function counts() {
  const p = getProfile()
  return {
    bookings: p.bookings.length,
    events: p.cars.reduce((n, c) => n + c.events.length, 0),
  }
}

async function waitUntil(desc: string, pred: () => boolean, timeoutMs = 8000): Promise<void> {
  const t0 = Date.now()
  while (!pred()) {
    if (Date.now() - t0 > timeoutMs) throw new Error(`wait timeout (${timeoutMs}ms): ${desc}`)
    await sleep(15)
  }
}

async function runCase(c: EvalCase): Promise<CaseResult> {
  resetWorld()
  const before = counts()
  const t0 = Date.now()
  const failures: string[] = []
  let decideError: string | undefined

  const run =
    c.scenario === 'claim'
      ? createClaimRun(c.inject as never)
      : createCareRun(c.inject as never, c.ttl)

  try {
    for (const a of c.actions) {
      if (a.type === 'wait') {
        if (a.status) await waitUntil(`run.status=${a.status}`, () => getRun(run.id)!.status === a.status)
        if (a.confirm) await waitUntil('confirm step present', () => getRun(run.id)!.steps.some((s) => s.confirm))
      } else if (a.type === 'confirm') {
        const cf = [...getRun(run.id)!.steps].reverse().find((s) => s.confirm)?.confirm
        if (!cf) throw new Error('no confirm step to act on')
        const r = decideRun(run.id, cf.token, a.decision ?? 'approve')
        if (!r.ok) decideError = r.error
      } else if (a.type === 'choose') {
        const r = chooseClaim(run.id, a.choice ?? 'self')
        if (!r.ok) decideError = r.error
      }
    }
    // 终态收敛（CARE_PACE=0 时执行阶段为数十毫秒真实异步）
    await waitUntil('terminal status', () =>
      ['done', 'failed', 'cancelled'].includes(getRun(run.id)!.status),
    )
  } catch (e) {
    failures.push(`runner: ${(e as Error).message}`)
  }

  const final = getRun(run.id)!
  const after = counts()
  const e = c.expect
  const kinds = final.steps.map((s) => s.kind)
  const check = (cond: boolean, msg: string) => {
    if (!cond) failures.push(msg)
  }

  if (e.finalStatus) check(final.status === e.finalStatus, `finalStatus: want ${e.finalStatus}, got ${final.status}`)
  for (const k of e.includesSteps ?? []) check(kinds.includes(k), `missing step: ${k}`)
  for (const k of e.excludesSteps ?? []) check(!kinds.includes(k), `unexpected step: ${k}`)
  for (const [k, want] of Object.entries(e.stepDegraded ?? {})) {
    const st = final.steps.find((s) => s.kind === k)
    check(!!st?.degraded === want, `step[${k}].degraded: want ${want}, got ${!!st?.degraded}`)
  }
  if (e.runDegraded !== undefined)
    check((final.degradations.length > 0) === e.runDegraded, `runDegraded: want ${e.runDegraded}, got ${final.degradations.length > 0}`)
  if (e.bookingsDelta !== undefined)
    check(after.bookings - before.bookings === e.bookingsDelta, `bookingsDelta: want ${e.bookingsDelta}, got ${after.bookings - before.bookings}`)
  if (e.eventsDelta !== undefined)
    check(after.events - before.events === e.eventsDelta, `eventsDelta: want ${e.eventsDelta}, got ${after.events - before.events}`)
  if (e.decideError) check(decideError === e.decideError, `decideError: want ${e.decideError}, got ${decideError ?? 'none'}`)
  if (e.titleContains)
    check(final.steps.some((s) => s.title.includes(e.titleContains!)), `no step title contains "${e.titleContains}"`)

  return {
    id: c.id,
    name: c.name,
    scenario: c.scenario,
    inject: c.inject,
    passed: failures.length === 0,
    failures,
    durationMs: Date.now() - t0,
    runId: final.id,
    finalStatus: final.status,
    steps: final.steps.map((s) => ({ seq: s.seq, kind: s.kind, title: s.title, degraded: !!s.degraded })),
    degradations: final.degradations,
    deltas: { bookings: after.bookings - before.bookings, events: after.events - before.events },
  }
}

/* ---------------- 报告 ---------------- */

function writeReport(results: CaseResult[], totalMs: number) {
  const at = new Date().toISOString()
  const passed = results.filter((r) => r.passed).length
  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    LLM_PROVIDER: process.env.LLM_PROVIDER,
    CARE_PACE: process.env.CARE_PACE,
    node: process.version,
  }

  const json = { at, env, total: results.length, passed, failed: results.length - passed, totalMs, cases: results }
  mkdirSync(join(HERE, 'report'), { recursive: true })
  writeFileSync(join(HERE, 'report', 'report.json'), JSON.stringify(json, null, 2))

  const lines: string[] = [
    '# 识途 · eval 运行报告（复赛运行证据）',
    '',
    `- 运行时间：${at}`,
    `- 环境：DATABASE_URL=\`${env.DATABASE_URL}\` · LLM_PROVIDER=\`${env.LLM_PROVIDER}\` · CARE_PACE=\`${env.CARE_PACE}\` · Node ${env.node}`,
    `- 结果：**${passed}/${results.length} 通过** · 总耗时 ${totalMs} ms`,
    '',
    '| # | 用例 | 场景 | 注入 | 终态 | 降级 | 结果 |',
    '|---|------|------|------|------|------|------|',
  ]
  results.forEach((r, i) => {
    lines.push(
      `| ${i + 1} | ${r.id} | ${r.scenario} | ${r.inject} | ${r.finalStatus} | ${r.degradations.length ? '是' : '否'} | ${r.passed ? 'PASS' : 'FAIL'} |`,
    )
  })
  lines.push('')
  for (const r of results) {
    lines.push(`## ${r.id} — ${r.name}`, '')
    lines.push(`- run：\`${r.runId}\` · 终态 \`${r.finalStatus}\` · 耗时 ${r.durationMs} ms`)
    lines.push(`- 档案增量：预约 +${r.deltas.bookings} · 事件 +${r.deltas.events}`)
    if (r.degradations.length) lines.push(`- 降级链路：${r.degradations.map((d) => '「' + d + '」').join(' ')}`)
    if (r.failures.length) lines.push(`- 失败原因：${r.failures.join('；')}`)
    lines.push('', '| seq | 步骤 | 标题 | 降级 |', '|-----|------|------|------|')
    for (const s of r.steps) lines.push(`| ${s.seq} | ${s.kind} | ${s.title} | ${s.degraded ? '⚠ 是' : '否'} |`)
    lines.push('')
  }
  writeFileSync(join(HERE, 'report', 'report.md'), lines.join('\n'))
}

/* ---------------- main ---------------- */

async function main() {
  await loadState(() => ({ profile: seedProfile(), runs: [], audit: [] }))
  const caseDir = join(HERE, 'cases')
  const files = readdirSync(caseDir).filter((f) => f.endsWith('.json')).sort()
  const cases = files.map((f) => JSON.parse(readFileSync(join(caseDir, f), 'utf8')) as EvalCase)

  const t0 = Date.now()
  const results: CaseResult[] = []
  for (const c of cases) {
    const r = await runCase(c)
    results.push(r)
    console.log(`${r.passed ? 'PASS' : 'FAIL'}  ${r.id}  (${r.durationMs} ms)`)
    for (const f of r.failures) console.log(`      ↳ ${f}`)
  }
  await flushAll()
  writeReport(results, Date.now() - t0)

  const failed = results.filter((r) => !r.passed).length
  console.log(`\n${results.length - failed}/${results.length} passed · report → evals/report/report.md`)
  process.exit(failed ? 1 : 0)
}

void main()
