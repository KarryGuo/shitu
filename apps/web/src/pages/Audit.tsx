import { useCallback, useEffect, useState } from 'react'
import { useReveal } from '../hooks/useReveal'
import { SectionHead, Note } from '../components/ui'
import { api, type Metrics, type AuditFeed } from '../api/client'
import type { RunDTO } from '@shitu/shared'

/**
 * 运行审计（消费者证据页）：指标看板 + 工具健康 + 运行列表 + 审计日志。
 * 数据全部来自后端事实（/api/metrics · /api/runs · /api/audit），
 * 复赛「输出结果可追溯」的直接证据页。运行列表与审计日志支持分页浏览。
 */

/** 简易分页钩子：数据变化时自动收敛当前页 */
function usePaged<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = items.slice((safePage - 1) * pageSize, safePage * pageSize)
  return { page: safePage, totalPages, paged, setPage, total: items.length }
}

/** 分页控件：上一页 / 页码 / 下一页 */
function Pager({ page, totalPages, total, unit, onPage }: { page: number; totalPages: number; total: number; unit: string; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 pt-3.5 mt-1 border-t border-line">
      <button
        className="btn btn-ghost !py-1.5 !px-3.5 !text-[13px]"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        上一页
      </button>
      <span className="text-faint text-[13px] num">
        {page} / {totalPages} 页 · 共 {total} 条{unit}
      </span>
      <button
        className="btn btn-ghost !py-1.5 !px-3.5 !text-[13px]"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        下一页
      </button>
    </div>
  )
}

const statusMeta: Record<string, { label: string; cls: string }> = {
  done: { label: '已完成', cls: 'bg-[#E3F1E6] text-[#2E7D46]' },
  waiting: { label: '待确认', cls: 'bg-[#F7EED8] text-[#8C6A1E]' },
  running: { label: '执行中', cls: 'bg-[#E8EEF4] text-[#3A6B8C]' },
  failed: { label: '已失败', cls: 'bg-[#F9E9E2] text-[#B4552D]' },
  cancelled: { label: '已取消', cls: 'bg-concrete-2 text-sub' },
  interrupted: { label: '已中断', cls: 'bg-concrete-2 text-sub' },
}

const actorMeta: Record<string, { label: string; cls: string }> = {
  agent: { label: 'Agent', cls: 'bg-hwy-tint text-hwy-deep' },
  user: { label: '车主', cls: 'bg-[#E8EEF4] text-[#3A6B8C]' },
  system: { label: '系统', cls: 'bg-concrete-2 text-sub' },
  admin: { label: '管理员', cls: 'bg-[#EAE6DA] text-[#6B5B33]' },
}

const fmtTime = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export default function Audit() {
  const revealRef = useReveal()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [audit, setAudit] = useState<AuditFeed | null>(null)
  const [runs, setRuns] = useState<RunDTO[]>([])
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string>('')

  /* 运行列表 / 审计日志分页（每页 10 条） */
  const runPages = usePaged(runs, 10)
  const auditEntries = audit?.entries ?? []
  const auditPages = usePaged(auditEntries, 10)

  const refresh = useCallback(async () => {
    try {
      const [m, a, r] = await Promise.all([api.getMetrics(), api.getAudit(), api.getRuns()])
      setMetrics(m)
      setAudit(a)
      setRuns(r.runs)
      setError(null)
      setUpdatedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
    } catch {
      setError('无法连接后端（localhost:8787）。请先启动：pnpm dev:api')
    }
  }, [])

  useEffect(() => {
    void refresh()
    const t = setInterval(() => void refresh(), 10000)
    return () => clearInterval(t)
  }, [refresh])

  return (
    <div ref={revealRef} className="pb-10">
      <SectionHead
        kicker="OPS · 运行审计"
        title="运行证据与指标看板"
        sub="任务运行、工具调用、降级链路与审计日志的服务端事实聚合 —— 每 10 秒自动刷新，输出结果全程可追溯。"
      />

      {error && (
        <div className="card p-5 mb-5 border-[#F9E9E2]">
          <div className="text-[#B4552D] font-bold text-[15px]">{error}</div>
        </div>
      )}

      {/* ===== 指标卡 ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {[
          { v: metrics ? String(metrics.runs.total) : '—', l: '任务运行总数' },
          {
            v: metrics?.runs.successRate === null || metrics?.runs.successRate === undefined ? '—' : `${metrics.runs.successRate}%`,
            l: '闭环成功率（已完成/已收敛）',
          },
          { v: metrics ? String(metrics.runs.degradedRuns) : '—', l: '经历降级的运行（仍办完）' },
          { v: metrics ? (metrics.runs.avgDurationMs ? `${(metrics.runs.avgDurationMs / 1000).toFixed(1)}s` : '—') : '—', l: '平均闭环耗时' },
        ].map((c, i) => (
          <div key={c.l} className="card px-5 py-4 reveal" style={{ transitionDelay: `${i * 60}ms` }}>
            <div className="font-black num text-[26px] leading-none">{c.v}</div>
            <div className="text-faint text-[12.5px] mt-2 tracking-[.04em]">{c.l}</div>
          </div>
        ))}
      </div>

      {/* ===== 适配器状态 ===== */}
      {metrics && (
        <div className="mt-5 reveal">
          <Note>
            <b>适配器状态：</b>
            LLM = <b>{metrics.providers.llm}</b>
            {metrics.providers.dashscopeKey ? '（DashScope Key 已配置）' : '（未配置 Key，走规则链路）'} · 地图 ={' '}
            <b>{metrics.providers.amap === 'live' ? '高德实时' : '演示数据'}</b> · 存储 = <b>{metrics.providers.db}</b> · 审计条目{' '}
            <b>{metrics.audit.total}</b> · 档案：车辆 {metrics.profile.cars} / 事件 {metrics.profile.events} / 预约{' '}
            {metrics.profile.bookings} / 待办提醒 {metrics.profile.remindersPending}
          </Note>
        </div>
      )}

      {/* ===== 工具健康表 ===== */}
      <section className="mt-8">
        <SectionHead kicker="TOOLS · 工具调用健康" title="每次调用都有留痕" />
        <div className="card overflow-x-auto reveal">
          {metrics && metrics.tools.length > 0 ? (
            <table className="plan-table">
              <thead>
                <tr>
                  <th>工具</th>
                  <th>调用次数</th>
                  <th>降级</th>
                  <th>失败</th>
                  <th>平均耗时</th>
                </tr>
              </thead>
              <tbody>
                {metrics.tools.map((t) => (
                  <tr key={t.name}>
                    <td className="!text-left font-semibold">{t.name}</td>
                    <td>{t.calls}</td>
                    <td className={t.degraded ? 'text-[#8C6A1E] font-bold' : ''}>{t.degraded || '—'}</td>
                    <td className={t.failed ? 'text-[#B4552D] font-bold' : ''}>{t.failed || '—'}</td>
                    <td>{t.avgLatencyMs !== null ? `${t.avgLatencyMs} ms` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-sub text-[14px] py-8 text-center">
              暂无工具调用记录 —— 去「保养」或「理赔」页发起一次任务闭环，工具调用数据将自动生成并留痕。
            </div>
          )}
        </div>
      </section>

      {/* ===== 运行列表 ===== */}
      <section className="mt-8">
        <SectionHead kicker="RUNS · 运行列表" title="每个任务的终态与降级记录" />
        <div className="card p-4 md:p-5 reveal">
          {runs.length === 0 ? (
            <div className="text-sub text-[14px] py-6 text-center">暂无运行记录 —— 去「保养」或「理赔」页发起一次任务闭环。</div>
          ) : (
            <div className="flex flex-col">
              {runPages.paged.map((r) => {
                const m = statusMeta[r.status] ?? statusMeta.running
                return (
                  <div key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 border-b border-line last:border-0">
                    <span className="num text-faint text-[13px]">{r.id}</span>
                    <span className={`text-[12px] font-bold rounded-md px-2 py-0.5 ${m.cls}`}>{m.label}</span>
                    <b className="text-[14.5px]">场景 · {r.scenario}</b>
                    {r.inject !== 'none' && (
                      <span className="text-[12px] font-bold rounded-md px-2 py-0.5 bg-[#F9E9E2] text-[#B4552D]">异常注入 {r.inject}</span>
                    )}
                    <span className="num text-faint text-[13px]">{r.steps.length} 步</span>
                    {r.degradations.length > 0 && (
                      <span className="text-[12.5px] text-[#8C6A1E]" title={r.degradations.join('\n')}>
                        ⚠ 降级 ×{r.degradations.length}
                      </span>
                    )}
                    <span className="num text-faint text-[12.5px] ml-auto">{fmtTime(r.createdAt)}</span>
                  </div>
                )
              })}
            </div>
          )}
          <Pager page={runPages.page} totalPages={runPages.totalPages} total={runPages.total} unit="" onPage={runPages.setPage} />
        </div>
      </section>

      {/* ===== 审计日志 ===== */}
      <section className="mt-8">
        <SectionHead kicker="AUDIT · 审计日志" title="谁、在什么时候、做了什么" />
        <div className="card p-4 md:p-5 reveal">
          {auditEntries.length === 0 ? (
            <div className="text-sub text-[14px] py-6 text-center">暂无审计记录。</div>
          ) : (
            <div className="flex flex-col">
              {auditPages.paged.map((e, i) => {
                const m = actorMeta[e.actor] ?? actorMeta.system
                return (
                  <div key={`${e.at}-${(auditPages.page - 1) * 10 + i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 border-b border-line last:border-0">
                    <span className="num text-faint text-[12.5px] w-[86px]">{fmtTime(e.at).slice(6)}</span>
                    <span className={`text-[12px] font-bold rounded-md px-2 py-0.5 ${m.cls}`}>{m.label}</span>
                    <span className="num text-[13.5px] font-semibold">{e.action}</span>
                    {e.detail && <span className="text-sub text-[13px]">{e.detail}</span>}
                    {e.runId && <span className="num text-faint text-[12px] ml-auto">{e.runId.slice(-8)}</span>}
                  </div>
                )
              })}
            </div>
          )}
          <Pager page={auditPages.page} totalPages={auditPages.totalPages} total={auditPages.total} unit="" onPage={auditPages.setPage} />
        </div>
      </section>

      <div className="text-faint text-[12.5px] mt-4 text-right">
        数据源：/api/metrics · /api/runs · /api/audit{updatedAt && ` · 最近刷新 ${updatedAt}`}
      </div>
    </div>
  )
}
