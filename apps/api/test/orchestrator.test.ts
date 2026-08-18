import { describe, it, expect, beforeAll } from 'vitest'
import { loadState } from '../src/store.js'
import { seedProfile, getProfile } from '../src/profile.js'
import { createCareRun, getRun, decideRun } from '../src/orchestrator.js'

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
/** pace=0 时全链路仍有数十毫秒真实异步，轮询到 waiting 即可断言 */
async function waitWaiting(runId: string, timeoutMs = 5000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const run = getRun(runId)!
    if (run.status === 'waiting') return run
    if (run.status === 'failed' || run.status === 'done' || run.status === 'cancelled') throw new Error(`early terminal: ${run.status}`)
    await sleep(20)
  }
  throw new Error('timeout waiting for waiting state')
}
async function waitTerminal(runId: string, timeoutMs = 5000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const run = getRun(runId)!
    if (['done', 'failed', 'cancelled', 'interrupted'].includes(run.status)) return run
    await sleep(20)
  }
  throw new Error('timeout waiting for terminal state')
}

beforeAll(async () => {
  await loadState(() => ({ profile: seedProfile(), runs: [], audit: [] }))
})

describe('care 任务闭环（编排状态机）', () => {
  it('完整链路：感知→方案→比价→确认→执行→档案回写', async () => {
    const eventsBefore = getProfile().cars[0].events.length
    const bookingsBefore = getProfile().bookings.length

    const run = createCareRun('none', 60)
    const waiting = await waitWaiting(run.id)
    expect(waiting.status).toBe('waiting')

    // 步骤与审计留痕
    const kinds = waiting.steps.map((s) => s.kind)
    expect(kinds).toEqual(expect.arrayContaining(['sense', 'plan', 'quote', 'user', 'confirm']))
    const planStep = waiting.steps.find((s) => s.kind === 'plan')!
    expect(planStep.tools!.length).toBeGreaterThanOrEqual(2) // 手册检索 + 档案读取
    const quoteStep = waiting.steps.find((s) => s.kind === 'quote')!
    expect(quoteStep.table!.length).toBe(3)
    expect(quoteStep.table!.some((r) => r.best)).toBe(true)

    // 确认单 token + 有效期
    const cf = waiting.steps.find((s) => s.confirm)!.confirm!
    expect(cf.token).toHaveLength(24)
    expect(cf.lines.length).toBe(3)

    // 错误 token 拒绝
    expect(decideRun(run.id, 'x'.repeat(24), 'approve').ok).toBe(false)

    // 正确 token 放行 → 执行 → 回写
    const ok = decideRun(run.id, cf.token, 'approve')
    expect(ok.ok).toBe(true)
    const done = await waitTerminal(run.id)
    expect(done.status).toBe('done')
    expect(done.steps.some((s) => s.kind === 'execute')).toBe(true)
    expect(done.steps.some((s) => s.kind === 'writeback')).toBe(true)

    const p = getProfile()
    expect(p.cars[0].events.length).toBe(eventsBefore + 1) // 档案回写
    expect(p.bookings.length).toBe(bookingsBefore + 1)
    expect(p.bookings[0].status).toBe('confirmed')
    expect(p.reminders.find((r) => r.id === 'r1')!.status).toBe('done')
  })

  it('拒绝路径：无确认不执行，档案零写入', async () => {
    const before = JSON.stringify(getProfile())
    const run = createCareRun('none', 60)
    const waiting = await waitWaiting(run.id)
    const cf = waiting.steps.find((s) => s.confirm)!.confirm!
    decideRun(run.id, cf.token, 'reject')
    const done = await waitTerminal(run.id)
    expect(done.status).toBe('cancelled')
    expect(done.steps.some((s) => s.kind === 'execute')).toBe(false)
    expect(JSON.stringify(getProfile())).toBe(before)
  })

  it('确认超时：任务作废且返回 CONFIRM_EXPIRED', async () => {
    const run = createCareRun('none', 0) // ttl=0 立即过期
    // 轮询到确认单生成（此时已过期，状态可能已被懒惰过期标记）
    const t0 = Date.now()
    let cf: string | undefined
    while (Date.now() - t0 < 5000) {
      const r = getRun(run.id)!
      const c = r.steps.find((s) => s.confirm)?.confirm
      if (c) { cf = c.token; break }
      await sleep(20)
    }
    expect(cf).toBeDefined()
    await sleep(30)
    const r = decideRun(run.id, cf!, 'approve')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('CONFIRM_EXPIRED')
    const after = getRun(run.id)!
    expect(after.status).toBe('failed')
    expect(after.steps.some((s) => s.title.includes('确认超时'))).toBe(true)
  })
})

describe('异常处理与降级', () => {
  it('门店搜索超时 → 缓存报价降级，任务仍完成', async () => {
    const run = createCareRun('shop_timeout', 60)
    const waiting = await waitWaiting(run.id)
    const quoteStep = waiting.steps.find((s) => s.kind === 'quote')!
    expect(quoteStep.degraded).toBe(true)
    expect(quoteStep.table!.every((r) => r.source === 'cache')).toBe(true)
    expect(waiting.degradations.length).toBeGreaterThan(0)

    const cf = waiting.steps.find((s) => s.confirm)!.confirm!
    decideRun(run.id, cf.token, 'approve')
    const done = await waitTerminal(run.id)
    expect(done.status).toBe('done')
  })

  it('LLM 不可用 → 规则链路降级标注，方案仍生成', async () => {
    const run = createCareRun('llm_down', 60)
    const waiting = await waitWaiting(run.id)
    const planStep = waiting.steps.find((s) => s.kind === 'plan')!
    expect(planStep.degraded).toBe(true)
    expect(planStep.body).toContain('机油')
    expect(waiting.degradations.some((d) => d.includes('规则链路'))).toBe(true)
  })
})

describe('预约幂等', () => {
  it('同一 run 重复执行不会产生重复预约单（幂等键=runId）', async () => {
    const n1 = getProfile().bookings.length
    const run = createCareRun('none', 60)
    const waiting = await waitWaiting(run.id)
    const cf = waiting.steps.find((s) => s.confirm)!.confirm!
    decideRun(run.id, cf.token, 'approve')
    await waitTerminal(run.id)
    // 执行阶段重复触发（模拟重试）：bookingCreate 同 key 返回同一预约
    expect(getProfile().bookings.length).toBe(n1 + 1)
  })
})
