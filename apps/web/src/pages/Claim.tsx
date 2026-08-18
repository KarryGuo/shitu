import { useEffect, useRef, useState, type ReactNode } from 'react'
import { RunTimeline, ToolChips, type TStep } from '../components/RunTimeline'
import { ConfirmCard } from '../components/ConfirmCard'
import { SectionHead, Note } from '../components/ui'
import { RoadProgress } from '../components/art'
import { useApp } from '../stores/app'
import { api } from '../api/client'
import type { RunDTO, RunStepDTO, InjectMode, ClaimChoice, ChoiceOption } from '@shitu/shared'

/**
 * 理赔护航（闭环 ②）：后端真实执行 ——
 * 照片(可上传真实照片,内存中转) → Qwen-VL 定损(可降级) → 决策参考(车主选择)
 * → 人工确认(HMAC token + TTL) → 材料与预约(幂等) → 档案归档。
 */

function rich(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>,
  )
}

const INJECTS: { value: InjectMode; label: string; hint: string }[] = [
  { value: 'none', label: '正常链路', hint: '全链路真实执行（Qwen-VL 真实调用）' },
  { value: 'insurer_timeout', label: '演练 · 门店查询超时', hint: '工具失败 → 缓存方案降级' },
  { value: 'llm_down', label: '演练 · 视觉模型不可用', hint: 'Qwen-VL 故障 → 规则基准定损' },
]

export default function Claim() {
  const [run, setRun] = useState<RunDTO | null>(null)
  const [inject, setInject] = useState<InjectMode>('none')
  const [starting, setStarting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const hydrated = useRef<string | null>(null)
  const hydrate = useApp((s) => s.hydrate)

  const status = run?.status
  const terminal = status === 'done' || status === 'failed' || status === 'cancelled' || status === 'interrupted'
  const phase: 'idle' | 'running' | 'waiting' | 'done' =
    status === 'waiting' ? 'waiting' : status === 'running' ? 'running' : terminal ? 'done' : 'idle'

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
        /* 下一拍重试 */
      }
    }, 600)
    return () => clearInterval(t)
  }, [run?.id, terminal, run?.status, hydrate])

  const start = async () => {
    setStarting(true)
    setApiError(null)
    try {
      setRun(await api.createClaimRun(inject, photo ?? undefined))
    } catch {
      setApiError('无法连接任务引擎（localhost:8787）。请先启动后端：pnpm dev:api，然后重新开始。')
      setRun(null)
    } finally {
      setStarting(false)
    }
  }

  const choose = async (choice: ClaimChoice) => {
    if (!run) return
    try {
      setRun(await api.chooseRun(run.id, choice))
    } catch {
      setApiError('决策提交失败，请重试。')
    }
  }

  const decide = async (decision: 'approve' | 'reject') => {
    if (!run) return
    const cf = [...run.steps].reverse().find((s) => s.confirm)?.confirm
    if (!cf) return
    try {
      setRun(await api.confirmRun(run.id, cf.token, decision))
    } catch {
      setApiError('确认请求失败，请稍后重试。')
    }
  }

  const onFile = (f: File | undefined) => {
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(String(reader.result))
    reader.readAsDataURL(f)
  }

  const steps: TStep[] = (run?.steps ?? []).map((s) => ({
    seal: s.seal,
    title: s.title,
    variant: s.kind === 'user' ? 'user' : s.kind === 'sense' || s.kind === 'plan' || s.kind === 'confirm' ? 'gold' : 'done',
    body: renderStep(s, choose, () => decide('approve'), () => decide('reject')),
  }))

  const assess = run?.steps.find((s) => s.assess)?.assess

  return (
    <div className="pb-10">
      <SectionHead
        kicker="闭环演示 ② · CLAIM COPILOT"
        title="理赔护航：一张照片，把小剐蹭变成小事"
        sub="上传损伤照片（或用样例照片），识途经多模态识别（Qwen-VL，可降级）给出定损参考与「自费还是走保险」决策对比，车主选择并确认后生成材料清单与门店方案，最终归档至车历。"
      />

      <div className="card overflow-hidden anim-up">
        {/* ===== 柏油演示台 ===== */}
        <div className="bg-asphalt text-white px-5 md:px-6 pt-4">
          <div className="flex flex-wrap items-center gap-3.5">
            <span className="font-sign text-[19px] tracking-[.08em]">理赔护航 · 多模态任务演示</span>
            <span className="ledboard !rounded-[6px] px-2.5 py-[3px] text-[12px]">
              {run ? `run=${run.id.slice(-6)} · ${run.status}` : 'scenario=claim · 后端真实执行'}
            </span>
            <div className="ml-auto flex gap-2.5">
              <button className="btn btn-bronze !py-2 !px-5 !text-[14.5px]" onClick={start} disabled={starting || phase === 'running' || phase === 'waiting'}>
                {phase === 'done' ? '重新演示' : starting ? '创建任务…' : photo ? '用我的照片开始' : '使用样例照片开始'}
              </button>
              <button
                className="btn !py-2 !px-5 !text-[14.5px] !bg-transparent !text-white/80 !border !border-white/25 hover:!border-white/60 hover:!text-white"
                onClick={() => { setRun(null); setApiError(null) }}
                disabled={phase === 'idle'}
              >
                停止
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-[12.5px] text-white/45 tracking-[.05em]">异常演练：</span>
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

          <RoadProgress steps={Math.min(run?.steps.length ?? 0, 6)} waiting={phase === 'waiting'} done={phase === 'done'} />
          <div className="text-white/45 text-[13px] pb-3 -mt-1">
            演示路线：照片接收 → 多模态定损 → 决策参考（<b className="text-mark">你来选</b>）→ 人工确认 → 材料与预约 → 归档
          </div>
        </div>

        {run && run.degradations.length > 0 && (
          <div className="bg-mark/15 border-b border-mark/40 px-5 py-2.5 text-[13.5px] text-mark-deep font-bold">
            ⚠ 本次运行发生降级 {run.degradations.length} 处（链路未中断）：
            {run.degradations.map((d) => ` ${d}`)}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-0">
          {/* 照片区：可上传真实照片（内存中转，不落盘） */}
          <div className="p-5 md:p-6 border-b md:border-b-0 md:border-r border-line bg-[#FBFAF8]">
            <div className="border-[1.5px] border-dashed border-line rounded-xl h-[240px] flex items-center justify-center bg-[#FBFAF6] overflow-hidden relative">
              {photo ? (
                <img src={photo} alt="上传的损伤照片" className="w-full h-full object-cover" />
              ) : run ? (
                <svg viewBox="0 0 400 250" className="w-full h-full anim-in">
                  <rect width="400" height="250" fill="#E8E4DA" />
                  <path d="M40 170 Q60 120 130 112 L300 108 Q360 112 372 150 L376 185 Q376 200 360 200 L52 200 Q38 200 40 185 Z" fill="#8F959E" />
                  <path d="M130 112 L300 108 L296 150 L138 152 Z" fill="#A8ADB6" />
                  <circle cx="110" cy="200" r="26" fill="#2B2E33" /><circle cx="110" cy="200" r="12" fill="#5A5F66" />
                  <circle cx="310" cy="200" r="26" fill="#2B2E33" /><circle cx="310" cy="200" r="12" fill="#5A5F66" />
                  <path d="M262 128 L318 142 M258 138 L310 152 M266 120 L305 130" stroke="#5C4632" strokeWidth="3" strokeLinecap="round" fill="none" />
                  <rect x="243" y="110" width="90" height="50" fill="none" stroke="#D9A400" strokeWidth="2.5" strokeDasharray="7 5" rx="6" className="route-flow" />
                  <text x="240" y="100" fontSize="13" fill="#8C6A1E" fontWeight="bold" fontFamily="sans-serif">损伤区域 · {assess?.part ?? '右后车门'}</text>
                </svg>
              ) : (
                <span className="text-faint text-[14.5px] px-6 text-center">
                  照片区域 · 等待上传<br />
                  <span className="text-[13px]">可上传真实损伤照片（仅内存中转识别，不落盘），或直接用样例照片</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-3">
              <label className={`text-[13.5px] font-bold rounded-lg px-3 py-1.5 cursor-pointer transition-colors border ${
                phase === 'running' || phase === 'waiting'
                  ? 'opacity-40 pointer-events-none border-line text-sub'
                  : 'border-hwy/40 text-hwy-deep hover:bg-hwy-tint'
              }`}>
                {photo ? '换一张照片' : '上传真实照片'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} disabled={phase === 'running' || phase === 'waiting'} />
              </label>
              {photo && (
                <button className="text-[13px] text-sub hover:text-mark-deep" onClick={() => setPhoto(null)} disabled={phase === 'running' || phase === 'waiting'}>
                  移除
                </button>
              )}
              <span className="text-sub text-[12.5px]">照片经 API 中转加密，仅用于本次识别</span>
            </div>
          </div>

          {/* 时间线（后端步骤渲染） */}
          <RunTimeline steps={steps} className="!bg-transparent max-h-[520px] min-h-[300px]" />
        </div>

        {apiError && (
          <div className="m-5 rounded-[10px] border border-mark/50 bg-mark/10 px-4 py-3 text-[14px] text-mark-deep font-bold">
            {apiError}
          </div>
        )}
      </div>

      <div className="mt-6 reveal">
        <Note>
          <b>边界提示：</b>责任认定与定损赔付，以交警部门与保险公司为准，识途只做信息整理与决策参考；置信度低于阈值时明确提示「建议人工核实」，不替用户下结论。上传的照片仅在内存中转用于识别，不落盘、不持久化。
        </Note>
      </div>
    </div>
  )
}

/** 单个服务端步骤 → 时间线气泡内容 */
function renderStep(
  s: RunStepDTO,
  onChoose: (c: ClaimChoice) => void,
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

  if (s.assess) {
    const a = s.assess
    nodes.push(
      <table key="as" className="plan-table">
        <tbody>
          <tr><td className="!text-faint w-[92px]">损伤部位</td><td><b>{a.part}</b></td></tr>
          <tr><td className="!text-faint">严重程度</td><td>{a.severity}</td></tr>
          <tr><td className="!text-faint">维修估价</td><td><b className="num text-[19px]">{a.range}</b></td></tr>
          <tr><td className="!text-faint">置信度</td><td>{Math.round(a.confidence * 100)}% <span className={a.confidence >= 0.7 ? 'text-hwy' : 'text-mark-deep font-bold'}>（{a.confidence >= 0.7 ? '≥70%，无需人工复核' : '不足，建议人工核实'}）</span></td></tr>
          <tr><td className="!text-faint">补拍建议</td><td>{a.repurchase}</td></tr>
          <tr><td className="!text-faint">识别引擎</td><td className={a.degraded ? 'text-mark-deep font-bold' : 'text-hwy'}>{a.provider}{a.degraded ? '（降级）' : ''}</td></tr>
        </tbody>
      </table>,
    )
    if (a.degraded && a.note)
      nodes.push(<div key="asn" className="text-[12.5px] text-mark-deep font-bold mt-1">⚠ {a.note}</div>)
  }

  if (s.options?.length)
    nodes.push(
      <div key="opt" className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
        {s.options.map((o: ChoiceOption) => (
          <button
            key={o.id}
            className={`text-left rounded-[10px] border p-3.5 transition-all bg-white hover:border-hwy`}
            onClick={() => onChoose(o.id)}
          >
            <b className="text-[16px]">{o.label} {o.badge && <span className="badge-best">{o.badge}</span>}</b>
            <div className="num text-[22px] mt-1">{o.price}</div>
            <div className="text-sub text-[13px] leading-[1.7] mt-1 whitespace-pre-line">{o.note}</div>
          </button>
        ))}
      </div>,
    )

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

  return <>{nodes}</>
}
