import { useEffect, useRef, type ReactNode } from 'react'

export type TStep = {
  /** 里程碑字：感 / 器 / 案 / 价 / 您 / 行 / 成 …… */
  seal: string
  title: string
  body: ReactNode
  variant?: 'gold' | 'user' | 'agent' | 'done'
  delay?: number
}

/**
 * RunTimeline：按 agent_steps 渲染 思考/工具/确认 过程。
 * 视觉为一条纵向公路：沥青路肩 + 黄虚线中线 + 里程碑桩。
 */
export function RunTimeline({ steps, className = '' }: { steps: TStep[]; className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = boxRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [steps.length])

  return (
    <div ref={boxRef} className={`flex flex-col gap-4 p-5 md:p-6 overflow-y-auto bg-concrete-2/60 ${className}`}>
      {steps.map((s, i) => (
        <div key={i} className="flex gap-4 anim-up" style={{ animationDelay: `${s.delay ?? 0}ms` }}>
          {/* 路肩 + 里程碑 */}
          <div className="relative w-[36px] shrink-0 self-stretch">
            {/* 沥青路肩 */}
            <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[14px] rounded-full bg-asphalt" />
            {/* 黄虚线中线 */}
            {i < steps.length - 1 && (
              <div
                className="absolute left-1/2 -translate-x-1/2 top-[38px] bottom-[-14px] w-[3px]"
                style={{ background: 'repeating-linear-gradient(to bottom, #FFC72C 0 10px, transparent 10px 22px)' }}
              />
            )}
            {/* 里程碑桩 */}
            <div className={`seal relative z-10 ${s.variant === 'done' || s.variant === 'user' ? 'done' : i === steps.length - 1 ? 'active' : ''}`}>
              {s.seal}
            </div>
          </div>
          {/* 气泡 */}
          <div className="flex-1 min-w-0 flex" style={{ justifyContent: s.variant === 'user' ? 'flex-end' : 'flex-start' }}>
            <div className={`msg ${s.variant === 'user' ? 'msg-user' : s.variant === 'gold' ? 'msg-gold' : 'msg-agent'}`}>
              <span className="who">{s.title}</span>
              {s.body}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** 工具芯片组：running 逐个点亮为 done */
export function ToolChips({ names, doneCount }: { names: string[]; doneCount: number }) {
  return (
    <span className="flex gap-2 flex-wrap mt-1">
      {names.map((n, i) => (
        <span key={n} className={`tool-chip ${i < doneCount ? 'done' : i === doneCount ? 'running' : ''}`}>
          {n}
        </span>
      ))}
    </span>
  )
}
