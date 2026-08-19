import { useEffect, useRef, useState, type ReactNode } from 'react'
import { RunTimeline, ToolChips, type TStep } from '../components/RunTimeline'
import { ConfirmCard } from '../components/ConfirmCard'
import { SectionHead, Note, NoCarGuard } from '../components/ui'
import { RoadProgress } from '../components/art'
import { useApp } from '../stores/app'
import { api } from '../api/client'
import type { RunDTO, RunStepDTO, InjectMode } from '@shitu/shared'

/**
 * 保养管家（闭环 ①）：本页不再播放录屏 —— 时间线每一步都来自
 * 后端编排器真实执行（POST /api/care/runs → 轮询 /api/runs/:id），
 * 工具调用、降级标注、确认单（HMAC token + 120s TTL）均为服务端事实。
 */

/** 行内 **加粗** 渲染 */
function rich(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>,
  )
}

const INJECTS: { value: InjectMode; label: string; hint: string }[] = [
  { value: 'none', label: '正常链路', hint: '全链路真实执行' },
  { value: 'shop_timeout', label: '门店搜索超时', hint: '工具超时 → 自动降级缓存报价' },
  { value: 'llm_down', label: 'LLM 不可用', hint: 'LLM 故障 → 自动降级规则链路' },
]

export default function Care() {
  const [run, setRun] = useState<RunDTO | null>(null)
  const [inject, setInject] = useState<InjectMode>('none')
  const [starting, setStarting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const hydrated = useRef<string | null>(null)
  const hydrate = useApp((s) => s.hydrate)
  const cars = useApp((s) => s.cars)

  const status = run?.status
  const terminal = status === 'done' || status === 'failed' || status === 'cancelled' || status === 'interrupted'
  const phase: 'idle' | 'running' | 'waiting' | 'done' =
    status === 'waiting' ? 'waiting' : status === 'running' ? 'running' : terminal ? 'done' : 'idle'

  /* 轮询运行状态；终止后同步档案回写结果 */
  useEffect(() => {
    if (!run?.id || terminal) return
    const t = setInterval(async () => {
      try {
        const r = await api.getRun(run.id)
        setRun(r)
        setApiError(null)
        if (['done', 'failed', 'cancelled', 'interrupted'].includes(r.status) && hydrated.current !== r.id) {
          hydrated.current = r.id
          hydrate(await api.getProfile())
        }
      } catch {
        /* 轮询失败保持现状，下一拍重试 */
      }
    }, 600)
    return () => clearInterval(t)
  }, [run?.id, terminal, run?.status, hydrate])

  const play = async () => {
    setStarting(true)
    setApiError(null)
    try {
      const r = await api.createCareRun(inject)
      setRun(r)
    } catch (e) {
      const hint = import.meta.env.DEV
        ? '无法连接任务引擎（localhost:8787）。请先启动后端：pnpm dev:api，然后重新发起。'
        : `任务引擎暂时连不上（${e instanceof Error ? e.message : '网络异常'}）。服务可能正在唤醒，请稍等几秒后重试。`
      setApiError(hint)
      setRun(null)
    } finally {
      setStarting(false)
    }
  }

  const decide = async (decision: 'approve' | 'reject') => {
    if (!run) return
    const cf = [...run.steps].reverse().find((s) => s.confirm)?.confirm
    if (!cf) return
    setConfirming(true)
    try {
      setRun(await api.confirmRun(run.id, cf.token, decision))
    } catch {
      setApiError('确认请求失败，请稍后重试。')
    } finally {
      setConfirming(false)
    }
  }

  const stop = () => {
    setRun(null)
    setApiError(null)
  }

  /* 服务端步骤 → 时间线视觉 */
  const steps: TStep[] = (run?.steps ?? []).map((s) => ({
    seal: s.seal,
    title: s.title,
    variant: s.kind === 'user' ? 'user' : s.kind === 'sense' || s.kind === 'plan' || s.kind === 'confirm' ? 'gold' : 'done',
    body: renderStep(s, confirming, () => decide('approve'), () => decide('reject')),
  }))

  // 空车库守卫：无档案不发起任务（档案由车主自己录入，识途不预填）
  if (cars.length === 0) return <NoCarGuard scene="发起保养任务" />

  return (
    <div className="pb-10">
      <SectionHead
        kicker="场景闭环 ① · PROACTIVE CARE"
        title="保养管家：从「发现」到「办完」"
        sub="时间线的每一步都由后端编排器真实执行：规则感知 → 手册检索 → 方案生成（LLM 可降级）→ 三方比价 → 人工确认（HMAC token + 120 秒有效期）→ 幂等预约 → 档案回写。可选异常注入，现场验证降级能力。"
      />

      <div className="card overflow-hidden anim-up">
        {/* ===== 柏油演示台：控制条 + 公路进度 ===== */}
        <div className="bg-asphalt text-white px-5 md:px-6 pt-4">
          <div className="flex flex-wrap items-center gap-3.5">
            <span className="font-sign text-[19px] tracking-[.08em]">保养管家 · 任务闭环</span>
            <span className="ledboard !rounded-[6px] px-2.5 py-[3px] text-[12px]">
              {run ? `run=${run.id.slice(-6)} · ${run.status}` : 'scenario=care · 后端真实执行'}
            </span>
            <div className="ml-auto flex gap-2.5">
              <button className="btn btn-bronze !py-2 !px-5 !text-[14.5px]" onClick={play} disabled={starting || phase === 'running' || phase === 'waiting'}>
                {phase === 'done' ? '再次发起' : starting ? '创建任务…' : '发起保养任务'}
              </button>
              <button
                className="btn !py-2 !px-5 !text-[14.5px] !bg-transparent !text-white/80 !border !border-white/25 hover:!border-white/60 hover:!text-white"
                onClick={stop}
                disabled={phase === 'idle'}
              >
                停止
              </button>
            </div>
          </div>

          {/* 异常注入（混沌测试：验证降级与容错能力） */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-[12.5px] text-white/45 tracking-[.05em]">异常注入：</span>
            {INJECTS.map((o) => (
              <button
                key={o.value}
                onClick={() => setInject(o.value)}
                disabled={phase === 'running' || phase === 'waiting'}
                title={o.hint}
                className={`px-3 py-1 rounded-full text-[12.5px] border transition-colors ${
                  inject === o.value
                    ? o.value === 'none'
                      ? 'bg-hwy text-white border-hwy'
                      : 'bg-mark text-asphalt border-mark font-bold'
                    : 'text-white/60 border-white/20 hover:border-white/50'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* 公路进度：感 案 价 确 行 成 */}
          <RoadProgress steps={run?.steps.length ?? 0} waiting={phase === 'waiting'} done={phase === 'done'} />
          <div className="text-white/45 text-[13px] pb-3 -mt-1">
            任务链路：主动感知 → 手册检索 → 方案生成 → 三方比价 → <b className="text-mark">人工确认（无确认不执行）</b> → 预约执行 → 档案回写
          </div>
        </div>

        {/* 降级横幅（异常处理证据） */}
        {run && run.degradations.length > 0 && (
          <div className="zebra-soft !py-1.5" />
        )}
        {run && run.degradations.length > 0 && (
          <div className="bg-mark/15 border-b border-mark/40 px-5 py-2.5 text-[13.5px] text-mark-deep font-bold">
            ⚠ 本次运行发生降级 {run.degradations.length} 处（链路未中断）：
            {run.degradations.map((d) => ` ${d}`)}
          </div>
        )}

        {/* 时间线（后端步骤渲染） */}
        <RunTimeline steps={steps} className="max-h-[560px] min-h-[300px]" />

        {!run && !apiError && (
          <div className="text-faint text-[14.5px] text-center pb-8 -mt-2">
            点击上方「发起保养任务」，识途将真实执行一次完整的任务闭环 —— 花钱的事，最后一步由你亲手确认。
          </div>
        )}
        {apiError && (
          <div className="m-5 rounded-[10px] border border-mark/50 bg-mark/10 px-4 py-3 text-[14px] text-mark-deep font-bold">
            {apiError}
          </div>
        )}
      </div>

      <div className="mt-6 reveal">
        <Note>
          <b>可信设计：</b>时间线每一步对应后端 <code className="text-[13.5px]">agent_steps</code> 的审计记录（GET /api/audit 可查）；
          涉及花费的动作必须经过确认单（HMAC token + 120 秒有效期，过期自动作废），<b>无确认不执行</b>；
          门店搜索超时自动降级缓存报价，LLM 故障自动降级规则链路 —— 服务重启时等待确认的任务可继续，执行中的任务安全中断。
        </Note>
      </div>
    </div>
  )
}

/** 单个服务端步骤 → 时间线气泡内容 */
function renderStep(
  s: RunStepDTO,
  confirming: boolean,
  onApprove: () => void,
  onReject: () => void,
): ReactNode {
  const nodes: ReactNode[] = []

  if (s.error) nodes.push(<div key="err" className="text-mark-deep font-bold">{s.error}</div>)

  if (s.body)
    nodes.push(
      ...s.body.split('\n').map((line, i) => (
        <div key={`l${i}`} className={line.startsWith('⚠') ? 'text-mark-deep font-bold' : undefined}>
          {rich(line)}
        </div>
      )),
    )

  if (s.table) {
    const cache = s.table.every((r) => r.source === 'cache')
    nodes.push(
      <table key="tb" className="plan-table">
        <thead>
          <tr>
            <th>门店{cache && <span className="badge-best !bg-mark/20 !text-mark-deep">缓存</span>}</th>
            <th>报价</th>
            <th>距离</th>
            <th>评分</th>
          </tr>
        </thead>
        <tbody>
          {s.table.map((q) => (
            <tr key={q.name} className={q.best ? 'best' : ''}>
              <td>
                {q.name}
                {q.best && <span className="badge-best">性价比</span>}
              </td>
              <td className="num">¥{q.price}</td>
              <td>{q.distance}</td>
              <td>{q.rating}</td>
            </tr>
          ))}
        </tbody>
      </table>,
    )
  }

  if (s.tools?.length)
    nodes.push(
      <div key="tools" className="mt-1.5">
        <ToolChips names={s.tools.map((t) => t.name)} doneCount={s.tools.filter((t) => t.status !== 'running').length} />
        {s.tools
          .filter((t) => t.status === 'degraded' || t.status === 'failed')
          .map((t) => (
            <div key={t.name} className="text-[12.5px] text-mark-deep font-bold mt-1">
              ⚠ {t.name}：{t.note}
            </div>
          ))}
      </div>,
    )

  if (s.confirm)
    nodes.push(
      <ConfirmCard
        key="cf"
        title={s.confirm.title}
        lines={s.confirm.lines}
        seconds={s.confirm.secondsLeft}
        onApprove={onApprove}
        onReject={onReject}
      />,
    )

  void confirming
  return <>{nodes}</>
}
