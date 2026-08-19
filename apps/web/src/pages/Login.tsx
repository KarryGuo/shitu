import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp, DEMO_ACCOUNT, isDemoAccount } from '../stores/app'
import { AuthShell } from '../components/AuthShell'

/**
 * 登录：邮箱即身份，一步进入（体验环境免验证）。
 * 正式版规划：邮箱验证码 / 短信 OTP / 微信登录 —— 架构预留（store.login 已按身份隔离数据入口）。
 */

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
    // 新注册用户（空车库）与演示账号都先到档案页：前者进入建档引导，后者直接看演示档案
    navigate('/cars')
  }

  return (
    <AuthShell
      signLabel="服务区 · 登记"
      signEn="EMAIL SIGN-IN"
      title="欢迎回到识途"
      desc="输入邮箱即可进入；正式版接入邮箱验证码与短信 OTP 登录。"
      footer={
        <div className="flex flex-col gap-3">
          <div className="border-t border-dashed border-line pt-3 text-center">
            <span className="text-[13.5px] text-sub">还没有账号？</span>
            <Link to="/register" className="text-hwy-deep font-bold ml-1.5 hover:underline">
              注册一个 →
            </Link>
          </div>
          {isDemoAccount(email) && (
            <div className="badge-soft w-full text-center !text-[12.5px] py-1.5">
              演示账号：将载入预置示例档案（保养/年检/保险/理赔全流程可体验）
            </div>
          )}
        </div>
      }
    >
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
        <button className="btn btn-ink w-full !py-3" type="submit" disabled={!valid || entering}>
          {entering ? (
            <span className="thinking">
              <span />
              <span />
              <span />
            </span>
          ) : (
            '进入识途'
          )}
        </button>
        <p className="text-[12.5px] text-faint leading-[1.9]">
          登录即表示同意《用户协议》与《隐私政策》。识途最小化采集：不存 VIN 明文，照片 30 天自动清理，注销级联删除全部数据。
        </p>
      </form>

      <div className="mt-4 flex items-center gap-2 text-[12.5px] text-faint">
        <span>评委/演示可直接使用</span>
        <button
          type="button"
          className="font-num font-semibold text-hwy-deep bg-hwy-tint rounded-md px-2 py-0.5 hover:bg-hwy/15 transition-colors tracking-[.04em]"
          onClick={() => setEmail(DEMO_ACCOUNT)}
        >
          {DEMO_ACCOUNT}
        </button>
        <span>（含示例档案）</span>
      </div>
    </AuthShell>
  )
}
