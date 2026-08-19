import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp, DEMO_ACCOUNT } from '../stores/app'
import { AuthShell } from '../components/AuthShell'
import { authApi, ApiError } from '../api/client'

/**
 * 登录：手机号即身份，提交后端校验是否已注册（users 表）。
 * - 未注册 → 明确提示并引导去注册（携带手机号预填）
 * - 已禁用 → 提示联系管理员
 * - 演示账号（邮箱）兼容，供评审一键体验
 * 正式版规划：短信 OTP 验证码登录。
 */

const isPhone = (v: string) => /^1[3-9]\d{9}$/.test(v.trim())
const isEmail = (v: string) => /.+@.+\..+/.test(v.trim())

export default function Login() {
  const [params] = useSearchParams()
  const [account, setAccount] = useState(params.get('account') ?? '')
  const [entering, setEntering] = useState(false)
  const [error, setError] = useState<{ msg: string; needRegister?: boolean } | null>(null)
  const login = useApp((s) => s.login)
  const navigate = useNavigate()

  const valid = isPhone(account) || isEmail(account)
  const accountTrim = account.trim()

  const enter = async () => {
    if (!valid || entering) return
    setEntering(true)
    setError(null)
    try {
      const r = await authApi.login(accountTrim)
      login(r.user.account, r.user.name)
      // 新注册用户（空车库）与演示账号都先到档案页：前者进入建档引导，后者直接看演示档案
      navigate('/cars')
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'USER_NOT_FOUND')
          setError({ msg: '该账号尚未注册', needRegister: true })
        else if (e.code === 'USER_DISABLED') setError({ msg: '该账号已被禁用，请联系管理员' })
        else setError({ msg: e.message })
      } else {
        setError({ msg: '登录服务暂不可用，请稍后再试' })
      }
    } finally {
      setEntering(false)
    }
  }

  return (
    <AuthShell
      signLabel="服务区 · 登记"
      signEn="PHONE SIGN-IN"
      title="欢迎回到识途"
      desc="输入注册手机号即可进入；正式版接入短信验证码登录。"
      footer={
        <div className="flex flex-col gap-3">
          <div className="border-t border-dashed border-line pt-3 text-center">
            <span className="text-[13.5px] text-sub">还没有账号？</span>
            <Link to="/register" className="text-hwy-deep font-bold ml-1.5 hover:underline">
              注册一个 →
            </Link>
          </div>
          {accountTrim === DEMO_ACCOUNT && (
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
          void enter()
        }}
      >
        <div>
          <label className="field-label">手机号</label>
          <input
            className="field font-num tracking-[.06em]"
            type="text"
            inputMode="tel"
            placeholder="请输入注册手机号"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            maxLength={40}
            autoFocus
          />
        </div>

        {error && (
          <div className="rounded-[10px] border border-[#B4552D]/40 bg-[#F9E9E2] px-3.5 py-2.5 text-[13px] text-[#A0522D] font-bold flex items-center justify-between gap-2.5">
            <span>{error.msg}</span>
            {error.needRegister && (
              <Link
                to={`/register?account=${encodeURIComponent(accountTrim)}`}
                className="shrink-0 underline underline-offset-2"
              >
                去注册 →
              </Link>
            )}
          </div>
        )}

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
          onClick={() => setAccount(DEMO_ACCOUNT)}
        >
          {DEMO_ACCOUNT}
        </button>
        <span>（含示例档案）</span>
      </div>
    </AuthShell>
  )
}
