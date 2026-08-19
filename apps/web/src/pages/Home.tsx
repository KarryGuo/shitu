import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../stores/app'
import { useReveal } from '../hooks/useReveal'
import { JourneyStrip } from '../components/art'
import { Icons } from '../components/AppShell'

/**
 * 识途首页 · 夜航国道
 * 一条贯穿全页的「识车之途」：K0 出发 → K1 坑洼路段 → K2 服务区 → K3 指挥中心
 * → K4 车历长卷 → K5 岔路口（车主入口 / 管理看板）。
 * 桌面端左侧有随滚动行驶的里程轨道（小车 + 已驶里程）。
 */

/* ---------- 滚动进度：驱动里程轨道 ---------- */
function useScrollProgress() {
  const [p, setP] = useState(0)
  useEffect(() => {
    const on = () => {
      const h = document.documentElement
      const max = h.scrollHeight - h.clientHeight
      setP(max > 0 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0)
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
    }
  }, [])
  return p
}

/* ---------- 里程碑石（K0…K5） ---------- */
function KStone({ k }: { k: string }) {
  return (
    <span className="inline-flex flex-col rounded-[8px] overflow-hidden border-2 border-[#b9b7ae] bg-[#eceade] shadow-[0_3px_0_rgba(0,0,0,.18)] select-none shrink-0">
      <span className="bg-hwy text-white text-[8.5px] font-bold text-center py-[2px] tracking-[.3em] font-num px-2">KM</span>
      <span className="font-num font-bold text-[15px] text-asphalt px-2.5 py-[1px] leading-[1.35] text-center">{k}</span>
    </span>
  )
}

/* ---------- 段落标题 ---------- */
function SectionHead({
  k,
  kicker,
  title,
  desc,
  dark,
}: {
  k: string
  kicker: string
  title: React.ReactNode
  desc: string
  dark?: boolean
}) {
  return (
    <div className="max-w-[780px]">
      <div className="flex items-center gap-4">
        <KStone k={k} />
        <span className={`kicker ${dark ? '!text-mark' : ''}`}>{kicker}</span>
      </div>
      <h2 className={`font-display text-[30px] md:text-[40px] leading-[1.3] mt-5 ${dark ? 'text-white' : 'text-ink'}`}>{title}</h2>
      <p className={`text-[15px] leading-[2] mt-4 ${dark ? 'text-white/55' : 'text-sub'}`}>{desc}</p>
    </div>
  )
}

/* ============================================================
   夜航国道 —— 俯瞰视角的夜路 Hero：
   中央黄虚线向下流动，去程车渐行渐小，来车大灯迎面，
   龙门架挂着「识途服务区」指路牌，路边立着已入档的里程石。
   ============================================================ */
function AerialRoad() {
  return (
    <svg viewBox="0 0 1000 780" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" aria-hidden>
      <defs>
        <linearGradient id="hGround" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0c1013" />
          <stop offset="1" stopColor="#0a0d10" />
        </linearGradient>
        <linearGradient id="hAsphalt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d222a" />
          <stop offset="1" stopColor="#2b313a" />
        </linearGradient>
        <radialGradient id="hVillage" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f7d774" stopOpacity="0.3" />
          <stop offset="1" stopColor="#f7d774" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hTrail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFC72C" stopOpacity="0" />
          <stop offset="1" stopColor="#FFC72C" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="hCone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff8dc" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff8dc" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="hVin" cx="0.5" cy="0.42" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.42" />
        </radialGradient>
        <filter id="hGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {/* 地面 · 田垄肌理 */}
      <rect width="1000" height="780" fill="url(#hGround)" />
      <g stroke="#ffffff" strokeWidth="1" opacity="0.03" fill="none">
        <path d="M0 120 Q 300 90 520 150 T 1000 130" />
        <path d="M0 300 Q 260 340 480 280 T 1000 330" />
        <path d="M0 520 Q 320 560 560 490 T 1000 540" />
        <path d="M0 680 Q 280 640 520 700 T 1000 660" />
      </g>

      {/* 村落灯火 */}
      {[
        [110, 190], [170, 235], [92, 255], [856, 330], [905, 362],
        [130, 585], [92, 620], [872, 600], [918, 648], [790, 120], [60, 380], [940, 470],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="18" fill="url(#hVillage)" />
          <circle cx={x} cy={y} r={i % 3 === 0 ? 2.8 : 2} fill="#f7d774" opacity="0.95" />
        </g>
      ))}

      {/* 路基 · 路面 */}
      <polygon points="486,0 634,0 782,780 338,780" fill="#111419" />
      <polygon points="500,0 620,0 760,780 360,780" fill="url(#hAsphalt)" />

      {/* 路缘白线（带辉光） */}
      <path d="M500 0 L360 780" stroke="#dfe3e6" strokeWidth="8" opacity="0.18" strokeLinecap="round" fill="none" filter="url(#hGlow)" />
      <path d="M620 0 L760 780" stroke="#dfe3e6" strokeWidth="8" opacity="0.18" strokeLinecap="round" fill="none" filter="url(#hGlow)" />
      <path d="M500 0 L360 780" stroke="#e8ecef" strokeWidth="6" opacity="0.9" strokeLinecap="round" fill="none" />
      <path d="M620 0 L760 780" stroke="#e8ecef" strokeWidth="6" opacity="0.9" strokeLinecap="round" fill="none" />

      {/* 中央黄虚线：向前流动（黄光打底 + 实线） */}
      <line x1="560" y1="-20" x2="560" y2="800" stroke="#FFC72C" strokeWidth="20" opacity="0.16" filter="url(#hGlow)" />
      <line x1="560" y1="-20" x2="560" y2="800" stroke="#FFC72C" strokeWidth="13" strokeLinecap="butt" strokeDasharray="42 38" className="road-dash" />

      {/* 车道光痕：去程车的大灯照出的光（与车同周期亮起、渐散） */}
      <g className="car-trail">
        <polygon points="612,340 638,340 646,780 586,780" fill="url(#hTrail)" />
      </g>

      {/* 龙门架 + 指路牌 */}
      <g>
        <rect x="437" y="28" width="9" height="120" rx="3" fill="#3a414b" />
        <rect x="674" y="28" width="9" height="120" rx="3" fill="#3a414b" />
        <rect x="430" y="20" width="260" height="9" rx="3" fill="#3a414b" />
        <line x1="500" y1="29" x2="500" y2="46" stroke="#3a414b" strokeWidth="4" />
        <line x1="620" y1="29" x2="620" y2="46" stroke="#3a414b" strokeWidth="4" />
        <rect x="452" y="46" width="216" height="52" rx="9" fill="#0D7A4F" />
        <rect x="459" y="53" width="202" height="38" rx="5" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2" />
        <text x="560" y="72" textAnchor="middle" fontSize="19" fill="#fff" letterSpacing="3" fontFamily="'ZCOOL QingKe HuangYou','Noto Sans SC',sans-serif">识途服务区</text>
        <text x="560" y="88" textAnchor="middle" fontSize="10.5" fill="rgba(255,255,255,.8)" letterSpacing="2" fontFamily="'Barlow Condensed',sans-serif">SHITU SERVICE · 2 km →</text>
      </g>

      {/* 里程石：每一程都入档（品牌石，不绑定具体里程） */}
      <g transform="translate(388,600)">
        <rect width="64" height="46" rx="8" fill="#eceade" stroke="#b9b7ae" strokeWidth="2" />
        <rect x="3" y="3" width="58" height="10" rx="5" fill="#0D7A4F" />
        <text x="32" y="30" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1B1F24" letterSpacing="1" fontFamily="'ZCOOL QingKe HuangYou','Noto Sans SC',sans-serif">每一程</text>
        <text x="32" y="41" textAnchor="middle" fontSize="8" fill="#5d646d" letterSpacing="1" fontFamily="'Noto Sans SC',sans-serif">都 · 入 · 档</text>
      </g>

      {/* 去程车：驶向远方 */}
      <g transform="translate(625,330)">
        <g className="car-away">
          <ellipse cx="0" cy="30" rx="13" ry="4" fill="#ff5a4e" opacity="0.18" />
          <rect x="-17" y="-32" width="34" height="64" rx="10" fill="#2c333c" stroke="#3a424d" strokeWidth="1.5" />
          <rect x="-13" y="-24" width="26" height="15" rx="4" fill="#151a20" />
          <rect x="-13" y="8" width="26" height="14" rx="4" fill="#151a20" />
          <rect x="-14" y="24" width="10" height="5" rx="2" fill="#ff5a4e" />
          <rect x="4" y="24" width="10" height="5" rx="2" fill="#ff5a4e" />
        </g>
      </g>

      {/* 来车：迎面而来，大灯照亮前路 */}
      <g transform="translate(497,330)">
        <g className="car-toward">
          <polygon points="-13,30 13,30 30,130 -30,130" fill="url(#hCone)" className="beam" />
          <ellipse cx="0" cy="-30" rx="13" ry="4" fill="#fff8dc" opacity="0.14" />
          <rect x="-17" y="-32" width="34" height="64" rx="10" fill="#3a424d" stroke="#4a525d" strokeWidth="1.5" />
          <rect x="-13" y="-24" width="26" height="15" rx="4" fill="#151a20" />
          <rect x="-13" y="8" width="26" height="14" rx="4" fill="#151a20" />
          <rect x="-14" y="24" width="10" height="5" rx="2" fill="#fff3c4" />
          <rect x="4" y="24" width="10" height="5" rx="2" fill="#fff3c4" />
        </g>
      </g>

      {/* 暗角 */}
      <rect width="1000" height="780" fill="url(#hVin)" />
    </svg>
  )
}

/* ---------- LED 情报板（跑马灯） ---------- */
function LedTicker() {
  const items = [
    '保养到期主动提醒',
    '年检临期提前预警',
    '出险理赔一键立案',
    '维修保养多方比价',
    '关键动作车主确认',
    '全程留痕可审计',
    '预约到店免排队',
  ]
  const Unit = () => (
    <div className="flex items-center shrink-0">
      <span className="mx-5 text-mark">【识途情报板】</span>
      {items.map((t) => (
        <span key={t} className="mx-5 whitespace-nowrap">
          ▸ {t}
        </span>
      ))}
    </div>
  )
  return (
    <div className="ledboard relative z-10 border-x-0">
      <div className="marquee-track py-2 text-[14px] flex items-center">
        <Unit />
        <div aria-hidden>
          <Unit />
        </div>
        <span className="led-cursor ml-1">▊</span>
      </div>
    </div>
  )
}

/* ---------- 桌面端里程轨道：随滚动行驶 ---------- */
function JourneyRail({ progress }: { progress: number }) {
  const pct = Math.round(progress * 100)
  return (
    <div className="hidden xl:flex fixed left-[30px] top-0 bottom-0 z-40 pointer-events-none flex-col items-center" aria-hidden>
      <span className="bg-asphalt/85 text-white/55 text-[10.5px] font-num tracking-[.18em] rounded px-1.5 py-0.5">K0 · 出发</span>
      <div
        className="relative flex-1 w-[3px] my-3 rounded-full"
        style={{ backgroundImage: 'repeating-linear-gradient(to bottom, rgba(120,126,134,.55) 0 10px, transparent 10px 20px)' }}
      >
        <div className="absolute left-0 top-0 w-[3px] bg-mark rounded-full" style={{ height: `${progress * 100}%` }} />
        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ top: `${progress * 100}%` }}>
          <div className="bg-asphalt/90 rounded-md px-1.5 py-1 flex flex-col items-center gap-0.5 shadow-lg">
            <svg viewBox="0 0 56 26" className="w-7 h-3.5 -rotate-90">
              <path d="M4 20 L8 10 Q9.5 6 14 6 L34 6 Q40 6 44 11 L50 16 Q53 17.5 53 20 L53 21 Q53 23 50 23 L8 23 Q4 23 4 20 Z" fill="#FFC72C" />
              <path d="M14 8 L32 8 L36 15 L11 15 Z" fill="#1B1F24" opacity=".85" />
              <circle cx="16" cy="23" r="4" fill="#1B1F24" />
              <circle cx="16" cy="23" r="1.6" fill="#f2f1ec" />
              <circle cx="43" cy="23" r="4" fill="#1B1F24" />
              <circle cx="43" cy="23" r="1.6" fill="#f2f1ec" />
            </svg>
            <span className="font-num text-mark text-[10.5px] font-bold leading-none whitespace-nowrap">已行 {pct}%</span>
          </div>
        </div>
      </div>
      <span className="bg-asphalt/85 text-white/55 text-[10.5px] font-num tracking-[.18em] rounded px-1.5 py-0.5">K5 · 岔口</span>
    </div>
  )
}

/* ---------- 数据 ---------- */
const pains = [
  { t: '保养靠脑子记', d: '上次保养跑了多少公里？换的什么型号的油？想不起来，只能翻聊天记录、翻旧小票。' },
  { t: '年检临期才慌神', d: '错过年检上路，罚款扣分还误事；想起来的时候，检测站的号早就约满了。' },
  { t: '出险两眼一抹黑', d: '事故一出人就懵：先报警还是先报保险？材料要交哪些？定损单上的报价看不懂。' },
  { t: '维修报价没底', d: '同一个保养项目，三家店报三个价。不懂行情怕被坑，也只能硬着头皮先签单。' },
]

const powers = [
  { icon: Icons.archive, t: '车辆档案', en: 'ARCHIVE', d: '一车一档：里程、保养、保险、年检全记录，你的车的一生，一屏看得见。' },
  { icon: Icons.care, t: '智能保养', en: 'MAINTAIN', d: '里程 + 时间双规则盯守，到期主动提醒，对话里一句话发起保养任务。' },
  { icon: Icons.shield, t: '一键理赔', en: 'CLAIM', d: '出险后对话描述经过，Agent 生成理赔方案与材料清单，进度实时可查。' },
  { icon: Icons.calendar, t: '在线预约', en: 'BOOKING', d: '保养、年检在线预约直达门店，时间自己挑，到店免排队。' },
  { icon: Icons.pulse, t: '全程审计', en: 'AUDIT', d: '每一步操作留痕可查，回答附带依据面板，关键动作需你确认才执行。' },
  { icon: Icons.gear, t: '管理看板', en: 'ADMIN', d: '用户、车辆、任务全局视图，运营指标与 7 天趋势一屏掌握。' },
]

const guarantees = [
  { ch: '据', t: '有据可查', d: '每条回答附「依据」面板，来自你的真实车辆档案——不瞎编、不幻觉。' },
  { ch: '界', t: '有边有界', d: '关键动作必须车主确认：HMAC 签名留痕，超时自动作废，绝不先斩后奏。' },
  { ch: '溯', t: '有痕可溯', d: '全部对话与操作写入审计日志，每一步随时回看，数据三方同步。' },
]

const agentSteps = [
  { n: '感', t: '感知', d: '连档案，读车况' },
  { n: '案', t: '立案', d: '对话里建任务' },
  { n: '价', t: '比价', d: '调工具，比三家' },
  { n: '确', t: '确认', d: '你点头，才执行' },
  { n: '行', t: '执行', d: '进度实时可查' },
  { n: '成', t: '完成', d: '结果入档沉淀' },
]

/* ---------- 入口指路牌 ---------- */
function EntrySign({
  to,
  theme,
  lane,
  en,
  title,
  sub,
  desc,
  cta,
}: {
  to: string
  theme: 'green' | 'blue'
  lane: string
  en: string
  title: string
  sub: string
  desc: string
  cta: string
}) {
  return (
    <Link to={to} className="group relative flex flex-col items-center reveal">
      <div
        className={`sign w-full rounded-[18px] px-6 sm:px-8 pt-7 pb-8 text-center transition-transform duration-300 group-hover:-translate-y-1.5 ${
          theme === 'blue' ? '!bg-[#3f6fb5]' : ''
        }`}
        style={{ boxShadow: '0 26px 60px -28px rgba(0,0,0,.75)' }}
      >
        <div className="font-num text-[11.5px] tracking-[.3em] text-white/70 font-semibold">
          {lane} · {en}
        </div>
        <div className="font-sign text-[38px] sm:text-[44px] tracking-[.1em] mt-2.5 leading-none">{title}</div>
        <div className="text-[15px] text-white/85 mt-3.5">{sub}</div>
        <div className="text-[13px] text-white/60 mt-1 leading-[1.8]">{desc}</div>
        <span
          className={`btn !px-8 !py-2.5 !text-[15px] mt-6 ${
            theme === 'green' ? 'btn-bronze' : '!bg-white !text-asphalt hover:!bg-concrete'
          }`}
        >
          {cta} <span className="font-num">→</span>
        </span>
      </div>
      {/* 立柱与基座 */}
      <div className="w-[14px] h-[64px] bg-[#2e3b33] rounded-b-lg" />
      <div className="w-[64px] h-[10px] bg-[#242e28] rounded" />
    </Link>
  )
}

/* ============================================================
   首页
   ============================================================ */
export default function Home() {
  const user = useApp((s) => s.user)
  const progress = useScrollProgress()
  const painRef = useReveal<HTMLElement>()
  const powerRef = useReveal<HTMLElement>()
  const howRef = useReveal<HTMLElement>()
  const journeyRef = useReveal<HTMLElement>()
  const entryRef = useReveal<HTMLElement>()

  const mainTo = user ? '/cars' : '/login'
  const mainLabel = user ? '回到我的车库' : '车主入口 · 登录/注册'

  return (
    <div id="top" className="min-h-screen bg-[#0c1013] overflow-x-clip">
      <JourneyRail progress={progress} />

      {/* ===== 固定顶栏 ===== */}
      <header className="fixed top-0 inset-x-0 z-50">
        <div className="zebra h-[6px]" />
        <div className="bg-asphalt/95 backdrop-blur-md border-b-2 border-mark/90">
          <div className="max-w-[1180px] mx-auto px-5 md:px-7 h-[58px] flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <span className="sign sign-sm !bg-hwy px-3 py-1 font-sign text-[19px] tracking-[.12em] leading-none flex items-center h-[34px]">
                识途
              </span>
              <span className="hidden lg:block font-num text-[13px] tracking-[.3em] text-white/40 font-semibold">SHITU</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1 ml-3">
              {[
                ['#power', '能力'],
                ['#how', '怎么做事'],
                ['#journey', '车历长卷'],
                ['#entry', '入口'],
              ].map(([href, label]) => (
                <a key={href} href={href} className="nav-link">
                  {label}
                </a>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2.5">
              <Link
                to="/admin"
                className="hidden sm:inline-flex text-[13.5px] text-white/75 border border-white/25 rounded-lg px-3 py-1.5 hover:border-mark hover:text-mark transition-colors font-medium whitespace-nowrap"
              >
                管理看板
              </Link>
              {user ? (
                <Link to={mainTo} className="btn btn-bronze !py-1.5 !px-4 !text-[14px] whitespace-nowrap">
                  回到车库
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="inline-flex text-[13.5px] text-white/75 border border-white/25 rounded-lg px-3 py-1.5 hover:border-mark hover:text-mark transition-colors font-medium whitespace-nowrap"
                  >
                    登录
                  </Link>
                  <Link to="/register" className="btn btn-bronze !py-1.5 !px-4 !text-[14px] whitespace-nowrap">
                    注册
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* ===== K0 · 夜航国道 Hero ===== */}
        <section className="relative min-h-[100svh] flex flex-col overflow-hidden bg-[#0c1013]">
          <AerialRoad />
          {/* 左侧可读性渐变 */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c1013] via-[#0c1013]/65 md:via-[#0c1013]/30 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#0c1013] to-transparent pointer-events-none" />

          <div className="relative z-10 flex-1 flex items-center max-w-[1180px] w-full mx-auto px-5 md:px-7 pt-24 pb-10">
            <div className="max-w-[660px]">
              <div className="kicker !text-mark anim-up">AI AGENT · 智能用车管家</div>
              <h1 className="font-display text-[42px] sm:text-[54px] md:text-[66px] leading-[1.22] mt-5 text-white anim-up" style={{ animationDelay: '110ms' }}>
                车的事，
                <br />
                交给
                <span className="sign sign-sm !rounded-[16px] inline-flex items-center justify-center px-4 h-[1.16em] align-middle mx-1.5">识途</span>
                。
              </h1>
              <p className="text-white/65 text-[15.5px] md:text-[16.5px] mt-6 leading-[2.05] max-w-[560px] anim-up" style={{ animationDelay: '210ms' }}>
                识途 ShiTu —— 面向车主全生命周期的智能用车 Agent。识车之途，护你前路：
                把「人找服务」变成「服务找人」，替你
                <b className="text-mark">记着</b>每一次保养、<b className="text-mark">盯着</b>每一个期限、
                <b className="text-mark">办妥</b>每一件用车的事。
              </p>

              <div className="flex flex-wrap items-center gap-3.5 mt-9 anim-up" style={{ animationDelay: '300ms' }}>
                {user ? (
                  <Link to={mainTo} className="btn btn-bronze !px-7 !py-3 !text-[16px]">
                    {mainLabel} <span className="font-num">→</span>
                  </Link>
                ) : (
                  <>
                    <Link to="/register" className="btn btn-bronze !px-7 !py-3 !text-[16px]">
                      免费注册 · 建立我的车库 <span className="font-num">→</span>
                    </Link>
                    <Link
                      to="/login"
                      className="btn !bg-transparent !text-white !py-3 !px-6 !text-[15px] border-[1.5px] border-white/35 hover:!border-mark hover:!text-mark"
                    >
                      已有账号 · 登录 <span className="font-num">→</span>
                    </Link>
                  </>
                )}
                <Link
                  to="/admin"
                  className="btn !bg-transparent !text-white !py-3 !px-6 !text-[15px] border-[1.5px] border-white/35 hover:!border-mark hover:!text-mark"
                >
                  管理员看板 <span className="font-num">→</span>
                </Link>
              </div>

              <div className="flex flex-wrap gap-x-7 gap-y-2.5 mt-10 anim-up" style={{ animationDelay: '400ms' }}>
                {[
                  ['全生命周期', '车辆档案'],
                  ['到期主动', '盯守提醒'],
                  ['任务闭环', '执行可追踪'],
                  ['全程留痕', '操作可审计'],
                ].map(([a, b]) => (
                  <span key={a} className="flex items-center gap-2 text-[13.5px] text-white/65">
                    <span className="w-[7px] h-[7px] rounded-[2px] bg-mark inline-block shrink-0" />
                    <b className="text-white font-bold">{a}</b>
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 下滑提示 */}
          <div className="relative z-10 pb-5 flex flex-col items-center gap-1 text-white/45 text-[12.5px] tracking-[.24em]">
            <span>往下开 · 看识途怎么替你办事</span>
            <span className="scroll-hint text-[17px] leading-none">∨</span>
          </div>

          <LedTicker />
        </section>

        {/* ===== K1 · 坑洼路段（痛点） ===== */}
        <section id="pain" ref={painRef} className="relative bg-concrete scroll-mt-[84px]">
          <div className="max-w-[1180px] mx-auto px-5 md:px-7 py-20 md:py-28">
            <div className="reveal">
              <SectionHead
                k="K1"
                kicker="PAIN · 用车路上的四个坑"
                title="用车这件事，坑比路多"
                desc="每个车主都遇到过——不是不想管，是记不住、看不懂、顾不上。"
              />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
              {pains.map((p, i) => (
                <div key={p.t} className="reveal card card-lift overflow-hidden" style={{ transitionDelay: `${i * 90}ms` }}>
                  <div className="zebra-soft" />
                  <div className="p-6">
                    <span className="num text-[30px] text-asphalt/[.16] leading-none">0{i + 1}</span>
                    <h3 className="font-bold text-[17px] mt-3">{p.t}</h3>
                    <p className="text-[13.5px] text-sub leading-[1.95] mt-2.5">{p.d}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="reveal mt-12 flex items-center gap-5">
              <div className="lane flex-1" />
              <p className="text-[15.5px] font-bold whitespace-nowrap">
                这四个坑，识途<span className="text-hwy-deep">一个一个替你填平</span>
              </p>
              <div className="lane flex-1" />
            </div>
          </div>
        </section>

        {/* ===== K2 · 服务区（六大能力） ===== */}
        <section id="power" ref={powerRef} className="relative bg-asphalt scroll-mt-[84px] overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(640px 320px at 82% 0%, rgba(13,122,79,.28), transparent 70%)' }}
          />
          <div className="relative max-w-[1180px] mx-auto px-5 md:px-7 py-20 md:py-28">
            <div className="reveal">
              <SectionHead
                dark
                k="K2"
                kicker="SERVICE · 识途服务区"
                title="六个服务区，一路照看"
                desc="从建档到理赔，识途把车主全生命周期的事，做成沿途的服务区——随时进站，随时照看。"
              />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
              {powers.map((p, i) => (
                <div
                  key={p.t}
                  className="reveal group relative rounded-[14px] bg-asphalt-2 border border-white/10 p-6 hover:border-mark/60 hover:-translate-y-1 transition-all duration-300"
                  style={{ transitionDelay: `${i * 70}ms` }}
                >
                  <div className="flex items-center gap-3.5">
                    <span className="sign sign-sm !rounded-[10px] w-[44px] h-[44px] flex items-center justify-center shrink-0 [&>svg]:w-[22px] [&>svg]:h-[22px]">
                      {p.icon}
                    </span>
                    <div>
                      <div className="font-sign text-[20px] tracking-[.06em] text-white leading-none">{p.t}</div>
                      <div className="font-num text-[11px] tracking-[.26em] text-white/35 font-semibold mt-1.5">{p.en}</div>
                    </div>
                    <span className="num ml-auto text-[26px] text-white/10">0{i + 1}</span>
                  </div>
                  <p className="text-[14px] text-white/60 leading-[1.95] mt-4">{p.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== K3 · 指挥中心（Agent 工作方式） ===== */}
        <section id="how" ref={howRef} className="bg-concrete-2 scroll-mt-[84px]">
          <div className="max-w-[1180px] mx-auto px-5 md:px-7 py-20 md:py-28">
            <div className="reveal">
              <SectionHead
                k="K3"
                kicker="AGENT · 识途怎么做事"
                title={
                  <>
                    不是陪你聊天的机器人，
                    <br />
                    是替你办事的 Agent
                  </>
                }
                desc="真实在线大模型 + 可调用的工具集：查档案、算周期、比价格、建任务。每一步都基于你的真实数据，不编故事。"
              />
            </div>
            <div className="grid lg:grid-cols-[.92fr_1.08fr] gap-6 mt-12 items-stretch">
              {/* 左：三个「有」 */}
              <div className="reveal ink-card p-7 md:p-9 flex flex-col justify-center gap-8">
                {guarantees.map((g) => (
                  <div key={g.t} className="flex gap-[18px]">
                    <span className="w-[46px] h-[46px] rounded-full border-2 border-mark flex items-center justify-center font-sign text-[21px] text-mark shrink-0">
                      {g.ch}
                    </span>
                    <div>
                      <div className="font-bold text-[16.5px] text-white">{g.t}</div>
                      <p className="text-[13.5px] text-white/55 leading-[1.95] mt-1.5">{g.d}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* 右：任务六步公路 */}
              <div className="reveal card p-7 md:p-9" style={{ transitionDelay: '130ms' }}>
                <div className="kicker">TASK ROAD · 一件事的六步</div>
                <div className="relative mt-9">
                  <div
                    className="hidden md:block absolute top-[21px] left-[8%] right-[8%] h-[2px]"
                    style={{ backgroundImage: 'repeating-linear-gradient(to right, rgba(217,164,0,.55) 0 10px, transparent 10px 20px)' }}
                  />
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-y-8 gap-x-2 relative">
                    {agentSteps.map((s, i) => (
                      <div key={s.n} className="flex flex-col items-center text-center gap-2">
                        <span
                          className={`seal ${i === 3 ? '!bg-mark !text-asphalt !border-mark-deep' : ''}`}
                          style={i === 3 ? { animation: 'kmPulse 1.6s ease-in-out infinite' } : undefined}
                        >
                          {s.n}
                        </span>
                        <span className="text-[14.5px] font-bold leading-none mt-0.5">{s.t}</span>
                        <span className="text-[12px] text-faint leading-[1.7]">{s.d}</span>
                        {i === 3 && (
                          <span className="text-[10.5px] bg-mark text-asphalt font-bold rounded px-1.5 py-[1.5px] leading-none mt-0.5">
                            超时作废
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[13px] text-faint leading-[1.9] mt-9 pt-5 border-t border-dashed border-line">
                  识途任务闭环的六座里程碑，与产品内的实时任务进度同源——感 · 案 · 价 · 确 · 行 · 成。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== K4 · 车历长卷 ===== */}
        <section id="journey" ref={journeyRef} className="relative bg-[#14181d] scroll-mt-[84px] overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(700px 340px at 18% 0%, rgba(13,122,79,.22), transparent 70%)' }}
          />
          <div className="relative max-w-[1180px] mx-auto px-5 md:px-7 py-20 md:py-28">
            <div className="reveal">
              <SectionHead
                dark
                k="K4"
                kicker="JOURNEY · 车历长卷"
                title="走过的每一步都亮着，该办的事都挂着"
                desc="识途把档案数据画成一条公路：左边是已入档的历史，右边是替你盯着的期限——这就是「识车之途」。"
              />
            </div>
            <div className="reveal mt-12" style={{ transitionDelay: '120ms' }}>
              <JourneyStrip
                past={[
                  { date: '2024-03', label: '首保入档' },
                  { date: '2024-09', label: '二保 · 更换机油机滤' },
                  { date: '2025-04', label: '续保 · 商业险' },
                  { date: '2025-11', label: '年检通过' },
                ]}
                now={{ km: '此刻', label: '下一段旅程 · 由你续写' }}
                future={[
                  { date: '即将', label: '三保 · 建议比 3 家' },
                  { date: '2026-05', label: '保险到期', urgent: true },
                  { date: '2026-09', label: '年检到期' },
                ]}
              />
            </div>
          </div>
        </section>

        {/* ===== K5 · 岔路口（双入口） ===== */}
        <section
          id="entry"
          ref={entryRef}
          className="relative scroll-mt-[84px] overflow-hidden"
          style={{ background: 'linear-gradient(165deg, #0a5f3c 0%, #0d3f2b 52%, #14181d 100%)' }}
        >
          <div className="relative max-w-[1080px] mx-auto px-5 md:px-7 py-20 md:py-28">
            <div className="reveal">
              <SectionHead
                dark
                k="K5"
                kicker="EXIT · 岔路口"
                title="选择你的车道"
                desc="两条道都已通车：把车交给识途照看，或进入看板管理运营。"
              />
            </div>

            {/* 龙门架 */}
            <div className="relative mt-16">
              <div className="hidden md:block absolute -top-[18px] left-[1%] right-[1%] h-[10px] bg-[#2e3b33] rounded-full" />
              <div className="hidden md:block absolute -top-[18px] bottom-[52px] left-[1%] w-[10px] bg-[#2e3b33] rounded-b-lg" />
              <div className="hidden md:block absolute -top-[18px] bottom-[52px] right-[1%] w-[10px] bg-[#2e3b33] rounded-b-lg" />
              <div className="grid md:grid-cols-2 gap-10 md:gap-14 relative z-10 mx-auto max-w-[840px]">
                <EntrySign
                  to="/login"
                  theme="green"
                  lane="车主车道"
                  en="CAR OWNERS"
                  title="车主入口"
                  sub="登录 · 邮箱一步进入"
                  desc="建立你的车辆档案，把保养、年检、理赔交给识途照看"
                  cta="进入识途"
                />
                <EntrySign
                  to="/admin"
                  theme="blue"
                  lane="管理车道"
                  en="ADMIN"
                  title="管理员看板"
                  sub="运营数据 · 一屏掌握"
                  desc="用户、车辆、任务与审计的全局视图，7 天趋势尽收眼底"
                  cta="打开看板"
                />
              </div>
              <p className="text-center mt-12 text-[14px] text-white/65 reveal">
                第一次来？<Link to="/register" className="text-mark font-bold hover:underline">免费注册 →</Link>
                <span className="text-white/40 ml-2">注册后车库为空，车辆档案由你自己录入，识途不预填任何假数据</span>
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ===== 页脚 ===== */}
      <footer className="bg-asphalt border-t-[3px] border-dashed border-mark/60">
        <div className="max-w-[1180px] mx-auto px-5 md:px-7 py-12">
          <div className="flex flex-wrap items-end gap-x-10 gap-y-8">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="sign sign-sm !bg-hwy px-3 py-1 font-sign text-[18px] tracking-[.12em] leading-none flex items-center h-[32px]">
                  识途
                </span>
                <span className="font-num text-[12px] tracking-[.3em] text-white/40 font-semibold">SHITU · 2026</span>
              </div>
              <div className="font-sign text-[22px] tracking-[.16em] mt-4 text-white/90">识车之途 · 护你前路</div>
              <p className="text-[13px] text-white/45 mt-2 max-w-[520px] leading-[1.95]">
                识途取意「老马识途」——识的不是路，是你的车走过的路。面向车主全生命周期的智能用车 Agent。
              </p>
              <p className="text-[12px] text-white/30 mt-1">体验环境 · 数据为样例，不涉及真实个人信息</p>
            </div>
            <div className="flex flex-col gap-2.5 text-[14px] md:ml-auto">
              <span className="text-white/40 text-[12px] tracking-[.24em] font-num font-semibold">QUICK LINKS · 快速通道</span>
              <Link to="/login" className="text-white/70 hover:text-mark transition-colors">
                车主入口 · 登录 →
              </Link>
              <Link to="/register" className="text-white/70 hover:text-mark transition-colors">
                新用户 · 免费注册 →
              </Link>
              <Link to="/admin" className="text-white/70 hover:text-mark transition-colors">
                管理员看板 →
              </Link>
              <Link to="/cars" className="text-white/70 hover:text-mark transition-colors">
                车辆档案（需登录）→
              </Link>
            </div>
            <span className="plate">识途 · 2026</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
