import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../stores/app'
import { AuthShell } from '../components/AuthShell'
import { authApi, ApiError } from '../api/client'

/**
 * 注册：手机号 + 昵称，提交后端写入 users 表（重复注册 409 拦截）。
 * 新账号从空车库开始 —— 进入后录入自己的第一辆车，档案全部由车主自己建立。
 * 正式版规划：短信验证码核验、实名认证。
 */

const isPhone = (v: string) => /^1[3-9]\d{9}$/.test(v.trim())

export default function Register() {
  const [params] = useSearchParams()
  const [account, setAccount] = useState(params.get('account') ?? '')
  const [nickname, setNickname] = useState('')
  const [entering, setEntering] = useState(false)
  const [error, setError] = useState<{ msg: string; needLogin?: boolean } | null>(null)
  const login = useApp((s) => s.login)
  const navigate = useNavigate()

  const accountValid = isPhone(account)
  const nameValid = nickname.trim().length >= 1
  const valid = accountValid && nameValid

  const enter = async () => {
    if (!valid || entering) return
    setEntering(true)
    setError(null)
    try {
      await authApi.register(account.trim(), nickname.trim())
      login(account.trim(), nickname.trim())
      navigate('/cars')
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'USER_EXISTS') setError({ msg: '该手机号已注册', needLogin: true })
        else setError({ msg: e.message })
      } else {
        setError({ msg: '注册服务暂不可用，请稍后再试' })
      }
    } finally {
      setEntering(false)
    }
  }

  return (
    <AuthShell
      signLabel="服务区 · 新办"
      signEn="CREATE ACCOUNT"
      title="注册识途，从你的车开始"
      desc="注册后车库为空 —— 录入你的第一辆车，识途替你记着、盯着、办妥。"
      footer={
        <div className="border-t border-dashed border-line pt-3 text-center">
          <span className="text-[13.5px] text-sub">已有账号？</span>
          <Link to="/login" className="text-hwy-deep font-bold ml-1.5 hover:underline">
            去登录 →
          </Link>
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
            placeholder="请输入手机号"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            maxLength={11}
            autoFocus
          />
        </div>
        <div>
          <label className="field-label">怎么称呼你</label>
          <input
            className="field"
            type="text"
            placeholder="例如：老周"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
          />
        </div>

        {error && (
          <div className="rounded-[10px] border border-[#B4552D]/40 bg-[#F9E9E2] px-3.5 py-2.5 text-[13px] text-[#A0522D] font-bold flex items-center justify-between gap-2.5">
            <span>{error.msg}</span>
            {error.needLogin && (
              <Link to={`/login?account=${encodeURIComponent(account.trim())}`} className="shrink-0 underline underline-offset-2">
                去登录 →
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
            '注册并进入识途'
          )}
        </button>
        <p className="text-[12.5px] text-faint leading-[1.9]">
          注册即表示同意《用户协议》与《隐私政策》。你的车辆档案仅自己可见；识途最小化采集，注销即级联删除全部数据。
          正式版将接入短信验证码核验。
        </p>
      </form>
    </AuthShell>
  )
}
