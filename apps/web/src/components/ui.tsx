import type { ReactNode } from 'react'

/** 区块标题：情报板 kicker + 标志字体大标题 + 副文案 */
export function SectionHead({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <div className="mb-8">
      <div className="kicker">{kicker}</div>
      <h2 className="font-display text-[27px] md:text-[33px] mt-2.5 leading-[1.3]">{title}</h2>
      {sub && <p className="text-sub text-[15.5px] mt-2.5 max-w-[820px]">{sub}</p>}
    </div>
  )
}

/** 深色面板内数字统计块 */
export function DarkStat({ value, label, delay = 0 }: { value: string; label: string; delay?: number }) {
  return (
    <div className="anim-up bg-white/10 rounded-[10px] px-3.5 py-3 border border-white/10" style={{ animationDelay: `${delay}ms` }}>
      <b className="num block text-[21px] md:text-[23px] text-mark leading-tight">{value}</b>
      <span className="text-[12px] text-white/55 tracking-[.08em]">{label}</span>
    </div>
  )
}

/** 情报板式提示条 */
export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="relative rounded-[12px] border border-hwy/25 bg-hwy-tint pl-5 pr-5 py-4 text-[14.5px] text-hwy-deep leading-[1.95] overflow-hidden">
      <span className="absolute left-0 top-0 bottom-0 w-[5px] bg-hwy" />
      {children}
    </div>
  )
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="card flex items-center justify-center py-16 text-faint text-[15px]">
      {text}
    </div>
  )
}
