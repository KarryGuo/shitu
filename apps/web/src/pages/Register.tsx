import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../stores/app'
import { AuthShell } from '../components/AuthShell'

/**
 * 注册：邮箱 + 昵称一步开通（体验环境免验证）。
 * 新账号从空车库开始 —— 进入后录入自己的第一辆车，档案全部由车主自己建立。
 * 正式版规划：邮箱验证码 / 短信 OTP 实名核验。
 */

export default function Register() {
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [entering, setEntering] = useState(false)
  const login = useApp((s) => s.login)
  const navigate = useNavigate()

  const emailValid = /.+@.+\..+/.test(email)
  const nameValid = nickname.trim().length >= 1
  const valid = emailValid && nameValid

  const enter = () => {
    if (!valid || entering) return
    setEntering(true)
    login(email, nickname)
    navigate('/cars')
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
          enter()
        }}
      >
        <div>
          <label className="field-label">怎么称呼你</label>
          <input
            className="field"
            type="text"
            placeholder="例如：老周"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            autoFocus
          />
        </div>
        <div>
          <label className="field-label">邮箱地址</label>
          <input
            className="field"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            '注册并进入识途'
          )}
        </button>
        <p className="text-[12.5px] text-faint leading-[1.9]">
          注册即表示同意《用户协议》与《隐私政策》。你的车辆档案仅自己可见；识途最小化采集，注销即级联删除全部数据。
          正式版将接入邮箱验证码核验。
        </p>
      </form>
    </AuthShell>
  )
}
