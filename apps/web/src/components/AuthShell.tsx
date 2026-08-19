import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PerspectiveRoad } from './art'

/**
 * 登录 / 注册 / 管理员登录共享骨架：
 * 夜色公路（车尾视角驶向龙门架）+ 左侧品牌叙事 + 右侧「服务区登记窗口」表单卡。
 * brand 参数可定制左侧叙事（缺省为车主端品牌文案），管理员登录页传入运营中枢叙事。
 */

export interface AuthBrandCopy {
  kicker: string
  title: ReactNode
  desc: string
  signs: { text: string; sub: string }[]
}

const DEFAULT_BRAND: AuthBrandCopy = {
  kicker: 'AI AGENT · 智能用车管家',
  title: (
    <>
      识途识的不是路，
      <br />
      是<span className="text-mark">你的车走过的路</span>
    </>
  ),
  desc: '每一次保养、年检、保险与理赔，识途都替你记着、盯着、办妥 —— 给每一辆车一份懂它的档案，给每一位车主一个会办事的伙伴，把「人找服务」变成「服务找人」。',
  signs: [
    { text: '知车', sub: '车辆数字档案' },
    { text: '懂你', sub: '长期记忆与偏好' },
    { text: '办事', sub: '工具调用 · 任务闭环' },
  ],
}

/** 龙门架指路牌方向项 */
function WaySign({ text, sub, delay }: { text: string; sub: string; delay: number }) {
  return (
    <div className="anim-up inline-flex" style={{ animationDelay: `${delay}ms` }}>
      <div className="sign sign-sm inline-flex items-center gap-3 pl-4 pr-3.5 py-[7px]">
        <span className="font-sign text-[17px] tracking-[.1em] leading-none">{text}</span>
        <span className="text-[12px] text-white/75 leading-none">{sub}</span>
        <span className="font-num text-[19px] leading-none text-mark">→</span>
      </div>
    </div>
  )
}

export function AuthShell({
  signLabel,
  signEn,
  title,
  desc,
  children,
  footer,
  brand = DEFAULT_BRAND,
}: {
  signLabel: string
  signEn: string
  title: string
  desc: string
  children: ReactNode
  footer?: ReactNode
  brand?: AuthBrandCopy
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#101419] text-[#EDEAE2]">
      {/* ===== 夜色公路：压扁为底部背景层（高度受控，不再挤占表单空间） ===== */}
      <div className="absolute inset-x-0 bottom-0 h-[34vh] max-h-[330px] min-h-[190px] overflow-hidden pointer-events-none" aria-hidden>
        <PerspectiveRoad className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[min(100%,860px)] opacity-90" />
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#101419] via-[#101419]/70 to-transparent" />
      </div>

      {/* ===== 主内容（移动端表单置顶：打开即见；桌面端左品牌右表单） ===== */}
      <div className="relative z-20 grid md:grid-cols-[1.1fr_.9fr] gap-10 lg:gap-14 items-center max-w-[1080px] w-full mx-auto px-6 md:px-8 py-12 md:py-16 pb-[24vh] md:pb-[30vh]">
        {/* -- 左：品牌（移动端排在表单之下） -- */}
        <div className="relative order-2 md:order-1">
          {/* 竖排水印 */}
          <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 [writing-mode:vertical-rl] font-sign text-[38px] tracking-[.55em] text-white/[.13] select-none pointer-events-none">
            识车之途
          </div>

          {/* 龙门架 Logo + 回首页 */}
          <div className="flex items-center gap-3 anim-up flex-wrap">
            <Link to="/" className="flex items-center gap-3 group">
              <span className="sign sign-sm px-3.5 py-1.5 font-sign text-[21px] tracking-[.14em] leading-none flex items-center">
                识途
              </span>
              <span className="font-num text-[14px] tracking-[.32em] text-white/40 font-semibold">SHITU</span>
              <span className="text-[13px] text-white/45 group-hover:text-mark transition-colors">← 返回首页</span>
            </Link>
          </div>

          <div className="mt-8 md:mt-10 max-w-[520px]">
            <div className="kicker !text-mark anim-up" style={{ animationDelay: '60ms' }}>
              {brand.kicker}
            </div>
            <h1 className="font-display text-[32px] md:text-[42px] leading-[1.32] mt-4 anim-up" style={{ animationDelay: '140ms' }}>
              {brand.title}
            </h1>
            <p className="text-white/55 text-[15.5px] mt-5 leading-[2] anim-up" style={{ animationDelay: '220ms' }}>
              {brand.desc}
            </p>

            {/* 指路牌三连：出口方向 */}
            <div className="flex flex-col items-start gap-2.5 mt-8">
              {brand.signs.map((s, i) => (
                <WaySign key={s.text} text={s.text} sub={s.sub} delay={300 + i * 90} />
              ))}
            </div>
          </div>
        </div>

        {/* -- 右：服务区办卡窗口（移动端置顶） -- */}
        <div className="w-full max-w-[420px] justify-self-center md:justify-self-end order-1 md:order-2">
          <div className="relative bg-concrete text-ink rounded-[16px] shadow-[0_30px_60px_-30px_rgba(0,0,0,.8)] anim-up" style={{ animationDelay: '180ms' }}>
            <div className="zebra-soft rounded-t-[16px]" />
            <div className="p-6 md:p-7">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="sign sign-sm !rounded-[8px] px-3 py-1 font-sign text-[15px] tracking-[.1em] leading-none flex items-center h-[30px]">
                  {signLabel}
                </span>
                <span className="font-num text-[12px] tracking-[.22em] text-faint font-semibold">{signEn}</span>
              </div>
              <h2 className="font-display text-[26px] mt-4">{title}</h2>
              <p className="text-sub text-[14px] mt-1.5 mb-6 leading-[1.9]">{desc}</p>
              {children}
            </div>
            {footer && <div className="px-6 md:px-7 pb-5">{footer}</div>}
          </div>

          <div className="mt-5 text-center text-[12px] text-white/35 tracking-[.08em] anim-up" style={{ animationDelay: '320ms' }}>
            识途 ShiTu · 面向车主全生命周期的智能用车 Agent
          </div>
        </div>
      </div>
    </div>
  )
}
