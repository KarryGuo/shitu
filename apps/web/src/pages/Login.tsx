import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../stores/app'
import { PerspectiveRoad } from '../components/art'

/**
 * 登录：邮箱即身份，一步进入（体验环境免验证）。
 * 正式版规划：邮箱验证码 / 短信 OTP / 微信登录 —— 架构预留（store.login 已按身份隔离数据入口）。
 */

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

export default function Login() {
  const [email, setEmail] = useState('')
  const [entering, setEntering] = useState(false)
  const login = useApp((s) => s.login)
  const navigate = useNavigate()

  const valid = /.+@.+\..+/.test(email)

  const enter = () => {
    if (!valid || entering) return
    setEntering(true)
    login(email)
    navigate('/cars')
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-[#101419] text-[#EDEAE2]">
      {/* ===== 夜色公路（页面底部，透视龙门架） ===== */}
      <div className="relative mt-auto w-full max-w-[920px] mx-auto shrink-0">
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#101419] to-transparent z-10 pointer-events-none" />
        <PerspectiveRoad />
      </div>

      {/* ===== 主内容 ===== */}
      <div className="relative z-20 flex-1 grid md:grid-cols-[1.15fr_.85fr] gap-10 lg:gap-14 items-center max-w-[1080px] w-full mx-auto px-6 md:px-8 pt-14 pb-6 md:pt-10">
        {/* -- 左：品牌 -- */}
        <div className="relative">
          {/* 竖排水印 */}
          <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 [writing-mode:vertical-rl] font-sign text-[38px] tracking-[.55em] text-white/[.13] select-none pointer-events-none">
            识车之途
          </div>

          {/* 龙门架 Logo */}
          <div className="flex items-center gap-3 anim-up">
            <span className="sign sign-sm px-3.5 py-1.5 font-sign text-[21px] tracking-[.14em] leading-none flex items-center">
              识途
            </span>
            <span className="font-num text-[14px] tracking-[.32em] text-white/40 font-semibold">SHITU</span>
          </div>

          <div className="mt-8 md:mt-10 max-w-[520px]">
            <div className="kicker !text-mark anim-up" style={{ animationDelay: '60ms' }}>
              AI AGENT · 智能用车管家
            </div>
            <h1 className="font-display text-[32px] md:text-[42px] leading-[1.32] mt-4 anim-up" style={{ animationDelay: '140ms' }}>
              识途识的不是路，
              <br />
              是<span className="text-mark">你的车走过的路</span>
            </h1>
            <p className="text-white/55 text-[15.5px] mt-5 leading-[2] anim-up" style={{ animationDelay: '220ms' }}>
              每一次保养、年检、保险与理赔，识途都替你记着、盯着、办妥 ——
              给每一辆车一份懂它的档案，给每一位车主一个会办事的伙伴，把「人找服务」变成「服务找人」。
            </p>

            {/* 指路牌三连：出口方向 */}
            <div className="flex flex-col items-start gap-2.5 mt-8">
              <WaySign text="知车" sub="车辆数字档案" delay={300} />
              <WaySign text="懂你" sub="长期记忆与偏好" delay={390} />
              <WaySign text="办事" sub="工具调用 · 任务闭环" delay={480} />
            </div>
          </div>
        </div>

        {/* -- 右：服务区办卡窗口 -- */}
        <div className="w-full max-w-[420px] justify-self-center md:justify-self-end">
          <div className="relative bg-concrete text-ink rounded-[16px] shadow-[0_30px_60px -30px_rgba(0,0,0,.8)] anim-up" style={{ animationDelay: '180ms' }}>
            <div className="zebra-soft rounded-t-[16px]" />
            <div className="p-6 md:p-7">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="sign sign-sm !rounded-[8px] px-3 py-1 font-sign text-[15px] tracking-[.1em] leading-none flex items-center h-[30px]">服务区 · 登记</span>
                <span className="font-num text-[12px] tracking-[.22em] text-faint font-semibold">EMAIL SIGN-IN</span>
              </div>
              <h2 className="font-display text-[26px] mt-4">进入识途</h2>
              <p className="text-sub text-[14px] mt-1.5 mb-6 leading-[1.9]">
                输入邮箱即可进入；正式版接入邮箱验证码与短信 OTP 登录。
              </p>

              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  enter()
                }}
              >
                <div>
                  <label className="field-label">邮箱地址</label>
                  <input
                    className="field"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                  />
                </div>
                <button className="btn btn-ink w-full !py-3" disabled={!valid || entering}>
                  {entering ? <span className="thinking"><span /><span /><span /></span> : '进入识途'}
                </button>
                <p className="text-[12.5px] text-faint leading-[1.9]">
                  登录即表示同意《用户协议》与《隐私政策》。识途最小化采集：不存 VIN 明文，照片 30 天自动清理，注销级联删除全部数据。
                </p>
              </form>
            </div>
          </div>

          <div className="mt-5 text-center text-[12px] text-white/35 tracking-[.08em] anim-up" style={{ animationDelay: '320ms' }}>
            识途 ShiTu · 面向车主全生命周期的智能用车 Agent
          </div>
        </div>
      </div>
    </div>
  )
}
