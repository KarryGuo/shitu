import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom'
import { useApp } from '../stores/app'

/* ---------- 图标（手绘线性风格） ---------- */
const sw = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const Icons = {
  archive: (
    <svg viewBox="0 0 24 24" {...sw}>
      <path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
      <path d="M4 11h16" />
    </svg>
  ),
  care: (
    <svg viewBox="0 0 24 24" {...sw}>
      <path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L4 17l3 3 4.7-4.7a4.5 4.5 0 0 0 6-6L15 12l-3-3 2.7-2.7Z" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" {...sw}>
      <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3Z" />
      <path d="M9.5 12l2 2 3.5-3.5" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" {...sw}>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 10h16M8 3v4M16 3v4" />
    </svg>
  ),
  gear: (
    <svg viewBox="0 0 24 24" {...sw}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v3M12 18.2v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5l2.6-1.5M17.2 9l2.6-1.5" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" {...sw}>
      <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2.5H4.5L6 16Z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  ),
  pulse: (
    <svg viewBox="0 0 24 24" {...sw}>
      <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
    </svg>
  ),
}

const tabs = [
  { to: '/cars', label: '档案', icon: Icons.archive },
  { to: '/care', label: '保养', icon: Icons.care },
  { to: '/claim', label: '理赔', icon: Icons.shield },
  { to: '/bookings', label: '预约', icon: Icons.calendar },
  { to: '/audit', label: '审计', icon: Icons.pulse },
  { to: '/settings', label: '设置', icon: Icons.gear },
]

export function AppShell() {
  const user = useApp((s) => s.user)
  const logout = useApp((s) => s.logout)
  const navigate = useNavigate()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen pb-[74px] md:pb-0">
      {/* ===== 固定顶栏（沥青） ===== */}
      <header className="fixed top-0 inset-x-0 z-50 bg-asphalt border-b-2 border-mark/90">
        <div className="max-w-[1080px] mx-auto px-5 md:px-7 h-[60px] flex items-center gap-5">
          {/* 标志牌 Logo */}
          <NavLink to="/cars" className="flex items-center gap-2.5 shrink-0">
            <span className="sign sign-sm !bg-hwy px-3 py-1 font-sign text-[19px] tracking-[.12em] leading-none flex items-center h-[34px]">
              识途
            </span>
            <span className="hidden lg:block font-num text-[13px] tracking-[.3em] text-white/40 font-semibold">SHITU</span>
          </NavLink>
          <nav className="hidden md:flex items-center gap-1.5 ml-4">
            {tabs.map((t) => (
              <NavLink key={t.to} to={t.to} className={({ isActive }) => `nav-link${isActive ? ' on' : ''}`}>
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden sm:block font-num text-[14px] tracking-[.08em] text-white/45">{user.email}</span>
            <button
              className="text-[13.5px] text-white/75 border border-white/25 rounded-lg px-3 py-1 hover:border-mark hover:text-mark transition-colors font-medium"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              登出
            </button>
          </div>
        </div>
      </header>

      {/* ===== 内容 ===== */}
      <main className="max-w-[1080px] mx-auto px-5 md:px-7 pt-[96px]">
        <Outlet />
      </main>

      {/* ===== 页脚（桌面端） ===== */}
      <footer className="hidden md:block mt-16 border-t-[3px] border-dashed border-mark/60">
        <div className="max-w-[1080px] mx-auto px-7 py-10 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <div className="font-sign text-[24px] tracking-[.18em]">识车之途 · 护你前路</div>
            <div className="text-[14px] text-faint mt-1.5">
              识途取意「老马识途」—— 识的不是路，是你的车走过的路。识途 ShiTu · 面向车主全生命周期的智能用车 Agent
            </div>
            <div className="text-[12.5px] text-faint/80 mt-0.5">本站为参赛演示 · 样例数据，不涉及真实个人信息</div>
          </div>
          <span className="plate ml-auto">GOAI · 2026</span>
        </div>
      </footer>

      {/* ===== 移动端底部导航 ===== */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t-[3px] border-dashed border-mark/70 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => `tab-item${isActive ? ' on' : ''}`}>
            {t.icon}
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
