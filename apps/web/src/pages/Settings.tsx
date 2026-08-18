import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../stores/app'
import { useReveal } from '../hooks/useReveal'
import { SectionHead, Note } from '../components/ui'

export default function Settings() {
  const user = useApp((s) => s.user)
  const prefs = useApp((s) => s.prefs)
  const setPrefs = useApp((s) => s.setPrefs)
  const logout = useApp((s) => s.logout)
  const deleteAccount = useApp((s) => s.deleteAccount)
  const resetDemo = useApp((s) => s.resetDemo)
  const navigate = useNavigate()
  const revealRef = useReveal()
  const [saved, setSaved] = useState(false)
  const [armDelete, setArmDelete] = useState(false)

  return (
    <div ref={revealRef} className="pb-10 max-w-[760px]">
      <SectionHead kicker="SETTINGS · 偏好与账户" title="设置" sub="识途的长期记忆：偏好写入档案摘要，planner 每次调用时注入，让方案越来越合你的习惯。" />

      {/* 账户 */}
      <div className="card p-6 reveal flex flex-wrap items-center gap-4">
        <div className="w-[52px] h-[52px] rounded-[14px] bg-asphalt text-mark font-sign text-[24px] flex items-center justify-center shrink-0">
          识
        </div>
        <div>
          <div className="font-bold text-[17px]">{user?.nickname ?? '未登录'}</div>
          <div className="text-sub text-[14px]">{user?.email} · 免费版 Free</div>
        </div>
        <button
          className="btn btn-ghost !py-2 !px-4 !text-[14px] ml-auto"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          登出
        </button>
      </div>

      {/* 偏好 */}
      <div className="card p-6 mt-5 reveal">
        <div className="font-black text-[17px] mb-1">我的偏好（长期记忆）</div>
        <p className="text-sub text-[14px] mb-5">影响保养方案档位、预约时间段与门店推荐排序。</p>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="field-label">保养预算</label>
            <select className="field" value={prefs.budget} onChange={(e) => setPrefs({ budget: e.target.value })}>
              <option>经济（¥300 内）</option>
              <option>适中（¥400–700）</option>
              <option>宽裕（¥700+，原厂件优先）</option>
            </select>
          </div>
          <div>
            <label className="field-label">方便时间</label>
            <select className="field" value={prefs.time} onChange={(e) => setPrefs({ time: e.target.value })}>
              <option>工作日晚上</option>
              <option>周末上午</option>
              <option>均可</option>
            </select>
          </div>
          <div>
            <label className="field-label">常去门店</label>
            <select className="field" value={prefs.frequentShop} onChange={(e) => setPrefs({ frequentShop: e.target.value })}>
              <option>畅行连锁养护</option>
              <option>顺达认证修理厂</option>
              <option>品牌 4S 店</option>
            </select>
          </div>
        </div>
        <button
          className="btn btn-ink mt-5 !py-2 !px-5 !text-[14.5px]"
          onClick={() => {
            setSaved(true)
            setTimeout(() => setSaved(false), 1800)
          }}
        >
          {saved ? '✓ 已保存并注入档案记忆' : '保存偏好'}
        </button>
        <button
          className="btn btn-ghost !border-line !text-sub mt-5 !py-2 !px-5 !text-[14.5px] ml-3"
          onClick={() => resetDemo()}
          title="将车辆、提醒、预约恢复为初始样例（大赛演示用）"
        >
          恢复演示样例数据
        </button>
      </div>

      {/* 合规 */}
      <div className="mt-5 reveal">
        <Note>
          <b>数据合规：</b>识途最小化采集 —— 不存 VIN 明文（仅 sha256 哈希），照片存 R2 且 30 天自动清理；删除账号时级联删除车辆、事件与消息并清理对象存储。
          本演示所有车辆、门店、价格均为构造样例，不涉及真实个人信息。
        </Note>
      </div>

      {/* 危险区 */}
      <div className="card p-6 mt-5 reveal border-[#E8D5CD]">
        <div className="font-black text-[17px] text-[#A0522D]">注销账号</div>
        <p className="text-sub text-[14px] mt-1 mb-4">将删除全部车辆档案、事件履历、预约与对话记录，不可恢复。</p>
        <button
          className={`btn !py-2 !px-5 !text-[14.5px] ${armDelete ? '!bg-[#A0522D] !text-white' : 'btn-ghost !border-[#A0522D]/40 !text-[#A0522D]'}`}
          onClick={() => {
            if (!armDelete) {
              setArmDelete(true)
              setTimeout(() => setArmDelete(false), 3500)
            } else {
              deleteAccount()
              navigate('/login')
            }
          }}
        >
          {armDelete ? '再点一次，确认永久注销' : '注销账号'}
        </button>
      </div>
    </div>
  )
}
