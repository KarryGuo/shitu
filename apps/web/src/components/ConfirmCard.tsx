import { useEffect, useState } from 'react'

/**
 * 确认关卡（§7.2 Confirmer）：凡涉及花费/报案/预约落单的动作，
 * 必须停车确认 —— 无确认不执行。视觉为收费站/检查站：斑马警示条 + 倒计时。
 */
export function ConfirmCard({
  title,
  lines,
  onApprove,
  onReject,
  seconds = 120,
}: {
  title: string
  lines: string[]
  onApprove: () => void
  onReject: () => void
  seconds?: number
}) {
  const [left, setLeft] = useState(seconds)
  const [done, setDone] = useState<'approved' | 'rejected' | 'expired' | null>(null)

  useEffect(() => {
    if (done) return
    const t = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          clearInterval(t)
          setDone('expired')
          return 0
        }
        return v - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [done])

  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')

  return (
    <div className="msg msg-gold !max-w-full !p-0 overflow-hidden !border-l-0">
      {/* 收费站警示条 */}
      <div className="zebra-soft" />
      <div className="p-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="who !mb-0">识途 · 停车确认（无确认不执行）</span>
          <span className="font-num text-[16px] font-bold text-mark-deep bg-white/70 rounded-md px-2 py-0.5 tabular-nums">
            {mm}:{ss}
          </span>
        </div>
        <div className="font-black text-[16.5px] mt-2">{title}</div>
        <ul className="mt-1.5 mb-1 text-[14.5px]">
          {lines.map((l) => (
            <li key={l} className="pl-1">
              · {l}
            </li>
          ))}
        </ul>
        {done === null ? (
          <div className="flex items-center gap-3 mt-2.5 flex-wrap">
            <button
              className="btn btn-bronze !py-2 !px-6 !text-[14.5px]"
              onClick={() => {
                setDone('approved')
                onApprove()
              }}
            >
              确认执行
            </button>
            <button
              className="btn btn-ghost !py-2 !px-5 !text-[14.5px]"
              onClick={() => {
                setDone('rejected')
                onReject()
              }}
            >
              再想想
            </button>
            <span className={`text-[12.5px] ${left <= 30 ? 'text-mark-deep font-bold' : 'text-faint'}`}>
              超时自动作废
            </span>
          </div>
        ) : (
          <div className="mt-1.5 text-[14.5px] font-bold">
            {done === 'approved' && <span className="text-hwy">已确认 · 开始执行</span>}
            {done === 'rejected' && <span className="text-sub">已取消 · 可随时重新发起</span>}
            {done === 'expired' && <span className="text-mark-deep">确认已过期 · 请重新发起方案</span>}
          </div>
        )}
      </div>
    </div>
  )
}
