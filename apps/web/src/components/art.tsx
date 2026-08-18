import { useEffect, useState } from 'react'

/**
 * 前路之光 —— 登录页 Hero（品牌叙事：识车之途 · 护你前路）：
 * 车尾视角驶向夜色：走过的路（近处）轮廓标亮着琥珀光、立着发光的里程石；
 * 前方的路（远处）被车灯束照亮，龙门架下悬挂品牌句副牌，替你护住前路。
 */
export function PerspectiveRoad({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 800 560" className={`w-full h-auto block ${className}`} aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141920" />
          <stop offset="1" stopColor="#0d1116" />
        </linearGradient>
        <linearGradient id="asphaltG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#20242b" />
          <stop offset="1" stopColor="#292e36" />
        </linearGradient>
        <radialGradient id="moonGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#e8ecf2" stopOpacity="0.45" />
          <stop offset="1" stopColor="#e8ecf2" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="townGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f7d774" stopOpacity="0.14" />
          <stop offset="1" stopColor="#f7d774" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="beamG" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fff8dc" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff8dc" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hazeV" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0e1216" stopOpacity="0.9" />
          <stop offset="1" stopColor="#0e1216" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 夜空 · 星 · 月 */}
      <rect width="800" height="560" fill="url(#sky)" />
      {[
        [92, 64], [176, 36], [298, 86], [520, 52], [640, 100], [730, 40], [420, 28], [58, 122], [360, 52], [760, 88],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1.2} fill="#dfe4ea" opacity={0.5} />
      ))}
      <circle cx="672" cy="72" r="46" fill="url(#moonGlow)" />
      <circle cx="672" cy="72" r="16" fill="#e6eaef" opacity="0.9" />
      <circle cx="676" cy="68" r="12" fill="#141920" opacity="0.12" />

      {/* 远山 · 远城辉光 */}
      <path d="M0 212 L98 172 L188 202 L292 178 L392 206 L508 176 L612 202 L712 180 L800 204 L800 232 L0 232 Z" fill="#0b0f13" />
      <ellipse cx="400" cy="214" rx="350" ry="50" fill="url(#townGlow)" />

      {/* 路面 */}
      <polygon points="352,212 448,212 772,560 28,560" fill="url(#asphaltG)" stroke="#171b20" strokeWidth="2" />

      {/* 车辙：轮胎磨亮的暗痕（识的车走过的路） */}
      <polygon points="357,560 369,560 407,216 403,216" fill="rgba(0,0,0,0.3)" />
      <polygon points="431,560 443,560 397,216 393,216" fill="rgba(0,0,0,0.3)" />
      <path d="M 357 560 L 403 216" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />
      <path d="M 443 560 L 397 216" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" />

      {/* 路缘白实线 */}
      <path d="M 366 212 L 96 560" stroke="#dfe3e6" strokeWidth="5" opacity="0.85" strokeLinecap="round" />
      <path d="M 434 212 L 704 560" stroke="#dfe3e6" strokeWidth="5" opacity="0.85" strokeLinecap="round" />

      {/* 远方雾霭 */}
      <rect x="330" y="212" width="140" height="44" fill="url(#hazeV)" />

      {/* 中央标线：向前流动 */}
      <line x1="400" y1="216" x2="400" y2="560" stroke="#FFC72C" strokeWidth="13" strokeLinecap="butt" strokeDasharray="34 46" className="road-dash" />

      {/* 路侧轮廓标：走过的路亮琥珀，前路的还暗着 */}
      {[
        { y: 500, lit: true }, { y: 442, lit: true }, { y: 392, lit: true },
        { y: 350, lit: false }, { y: 316, lit: false }, { y: 288, lit: false },
      ].map(({ y, lit }) => {
        const x = 74 + (y - 212) * 0.28
        return (
          <g key={y}>
            <rect x={x} y={y} width="8" height="14" rx="2" fill={lit ? '#FFC72C' : '#8b929b'} opacity={lit ? 0.95 : 0.5} />
            <rect x={726 - (y - 212) * 0.28} y={y} width="8" height="14" rx="2" fill={lit ? '#f0f2f4' : '#8b929b'} opacity={lit ? 0.7 : 0.45} />
            {lit && <ellipse cx={x + 4} cy={y + 18} rx="10" ry="3" fill="#FFC72C" opacity="0.18" />}
          </g>
        )
      })}

      {/* 里程石：已走过的路在发光 */}
      <g className="km-stone" transform="translate(96,446) rotate(-2)">
        <rect width="58" height="44" rx="8" fill="#eceade" stroke="#b9b7ae" strokeWidth="2" />
        <rect x="3" y="3" width="52" height="10" rx="5" fill="#0D7A4F" />
        <text x="29" y="31" textAnchor="middle" fontSize="15" fontWeight="700" fill="#1B1F24" fontFamily="'Barlow Condensed',sans-serif">43,200</text>
        <text x="29" y="41" textAnchor="middle" fontSize="8.5" fill="#5d646d" fontFamily="'Noto Sans SC',sans-serif">km · 已走过</text>
      </g>

      {/* 前路之光：车灯束（护你前路） */}
      <polygon points="368,396 432,396 414,214 386,214" fill="url(#beamG)" className="beam" />
      <circle cx="378" cy="396" r="5" fill="#fff8dc" opacity="0.9" />
      <circle cx="422" cy="396" r="5" fill="#fff8dc" opacity="0.9" />

      {/* 你的车（车尾视角） */}
      <g>
        <ellipse cx="400" cy="522" rx="84" ry="10" fill="#000" opacity="0.45" />
        <rect x="342" y="378" width="116" height="48" rx="16" fill="#2a3037" />
        <rect x="352" y="386" width="96" height="30" rx="9" fill="#161b21" />
        <path d="M356 412 L444 406" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <rect x="322" y="414" width="156" height="92" rx="20" fill="#303741" stroke="#3d454f" strokeWidth="2" />
        <rect x="326" y="456" width="148" height="5" rx="2.5" fill="#232830" />
        <circle cx="348" cy="445" r="11" fill="#ff5a4e" opacity="0.35" />
        <circle cx="452" cy="445" r="11" fill="#ff5a4e" opacity="0.35" />
        <rect x="330" y="438" width="36" height="14" rx="7" fill="#ff5a4e" />
        <rect x="434" y="438" width="36" height="14" rx="7" fill="#ff5a4e" />
        <rect x="336" y="441" width="24" height="8" rx="4" fill="#ffd0cc" opacity="0.8" />
        <rect x="440" y="441" width="24" height="8" rx="4" fill="#ffd0cc" opacity="0.8" />
        <rect x="374" y="464" width="52" height="18" rx="3" fill="#3f6fb5" stroke="rgba(255,255,255,0.92)" strokeWidth="1.5" />
        <text x="400" y="477.5" textAnchor="middle" fontSize="11.5" fill="#fff" letterSpacing="2" fontFamily="'ZCOOL QingKe HuangYou','Noto Sans SC',sans-serif">识途</text>
      </g>

      {/* 龙门架 */}
      <rect x="196" y="64" width="9" height="148" fill="#3a414b" rx="3" />
      <rect x="595" y="64" width="9" height="148" fill="#3a414b" rx="3" />
      <rect x="188" y="58" width="424" height="9" rx="3" fill="#3a414b" />
      <line x1="290" y1="67" x2="290" y2="88" stroke="#3a414b" strokeWidth="4" />
      <line x1="510" y1="67" x2="510" y2="88" stroke="#3a414b" strokeWidth="4" />

      {/* 主指路牌：识途 */}
      <g>
        <rect x="232" y="88" width="336" height="78" rx="12" fill="#0D7A4F" />
        <rect x="241" y="97" width="318" height="60" rx="7" fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2.5" />
        <text x="400" y="128" textAnchor="middle" fontSize="30" fill="#fff" fontFamily="'ZCOOL QingKe HuangYou','Noto Sans SC',sans-serif" letterSpacing="6">识途 SHITU</text>
        <text x="400" y="151" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,.85)" fontFamily="'Barlow Condensed',sans-serif" letterSpacing="4">NEXT · 你的专属用车管家</text>
      </g>

      {/* 副牌：品牌句 —— 护你前路 */}
      <line x1="340" y1="166" x2="340" y2="176" stroke="#3a414b" strokeWidth="3" />
      <line x1="460" y1="166" x2="460" y2="176" stroke="#3a414b" strokeWidth="3" />
      <g>
        <rect x="262" y="176" width="276" height="34" rx="8" fill="#0D7A4F" />
        <rect x="266" y="180" width="268" height="26" rx="5" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="1.5" />
        <text x="400" y="199" textAnchor="middle" fontSize="17" fill="#fff" letterSpacing="5" fontFamily="'ZCOOL QingKe HuangYou','Noto Sans SC',sans-serif">识车之途 · 护你前路</text>
      </g>
    </svg>
  )
}

/**
 * 里程仪表盘 —— 240° 车速表造型。
 * dark=true 用于深色/绿色牌面（白刻度黄指针）。
 */
export function Gauge({
  value,
  max,
  label,
  unit = 'km',
  dark = false,
  className = '',
}: {
  value: number
  max: number
  label: string
  unit?: string
  dark?: boolean
  className?: string
}) {
  const frac = Math.min(0.97, Math.max(0.03, value / max))
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 120)
    return () => clearTimeout(t)
  }, [])

  const R = 78
  const cx = 100
  const cy = 100
  const tickColor = dark ? 'rgba(255,255,255,.75)' : '#b9b7ae'
  const trackColor = dark ? 'rgba(255,255,255,.22)' : '#e4e2da'

  const pt = (r: number, deg: number) => {
    const rad = (deg * Math.PI) / 180
    return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)] as const
  }
  const ticks = []
  for (let i = 0; i <= 8; i++) {
    const deg = 150 - i * 30
    const major = i % 2 === 0
    const [x1, y1] = pt(major ? 66 : 70, deg)
    const [x2, y2] = pt(78, deg)
    ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={tickColor} strokeWidth={major ? 3 : 1.6} strokeLinecap="round" />)
  }

  const needleDeg = 90 - (mounted ? frac : 0.03) * 240
  const arcLen = (mounted ? frac : 0.03) * 240

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg viewBox="0 0 200 128" className="w-full max-w-[220px]">
        {/* 表盘轨道 */}
        <path d="M 32.5 61 A 78 78 0 1 1 167.5 61" fill="none" stroke={trackColor} strokeWidth="9" strokeLinecap="round" />
        {/* 数值弧 */}
        <path
          d="M 32.5 61 A 78 78 0 1 1 167.5 61"
          fill="none"
          stroke="#FFC72C"
          strokeWidth="9"
          strokeLinecap="round"
          pathLength={240}
          strokeDasharray={`${arcLen} 240`}
          style={{ transition: 'stroke-dasharray 1.3s cubic-bezier(.22,1,.36,1)' }}
        />
        {ticks}
        {/* 指针 */}
        <g style={{ transform: `rotate(${needleDeg}deg)`, transformOrigin: '100px 100px', transition: 'transform 1.3s cubic-bezier(.22,1,.36,1)' }}>
          <line x1="100" y1="100" x2="100" y2="38" stroke={dark ? '#FFC72C' : '#1B1F24'} strokeWidth="4" strokeLinecap="round" />
          <line x1="100" y1="100" x2="100" y2="112" stroke={dark ? '#FFC72C' : '#1B1F24'} strokeWidth="4" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="100" r="7" fill={dark ? '#FFC72C' : '#1B1F24'} />
        <circle cx="100" cy="100" r="2.6" fill={dark ? '#0D7A4F' : '#fff'} />
        <text x="32" y="52" fontSize="10" fill={tickColor} fontFamily="'Barlow Condensed',sans-serif">0</text>
        <text x="160" y="52" fontSize="10" fill={tickColor} fontFamily="'Barlow Condensed',sans-serif">{max >= 10000 ? `${Math.round(max / 1000)}k` : max}</text>
      </svg>
      <div className={`num text-[26px] leading-none mt-0.5 ${dark ? 'text-white' : 'text-asphalt'}`}>
        {value.toLocaleString()}
        <span className={`text-[13px] font-sans font-normal ml-1 ${dark ? 'text-white/60' : 'text-faint'}`}>{unit}</span>
      </div>
      <div className={`text-[12px] mt-0.5 tracking-[.14em] ${dark ? 'text-white/60' : 'text-faint'}`}>{label}</div>
    </div>
  )
}

/**
 * 公路进度条 —— 任务闭环的六座里程碑（感/案/价/确/行/成）。
 * 柏油路面 + 黄虚线中线 + 里程碑桩逐个点亮，小车滑行至当前进度。
 */
export function RoadProgress({ steps, waiting, done }: { steps: number; waiting: boolean; done: boolean }) {
  const posts = ['感', '案', '价', '确', '行', '成']
  let cur = 0
  if (steps >= 3) cur = 1
  if (steps >= 5) cur = 2
  if (waiting || steps >= 7) cur = 3
  if (steps >= 9) cur = 4
  if (done) cur = 5
  const lit = done ? 6 : cur + (waiting ? 0 : steps > 0 && steps < 3 ? 1 : 0)

  return (
    <div className="relative h-[58px] mt-3 select-none" aria-hidden>
      {/* 路面 */}
      <div className="absolute left-0 right-0 top-[30px] h-[10px] rounded-full bg-asphalt" />
      <div
        className="absolute left-[6px] right-[6px] top-[35px] h-[2px]"
        style={{ background: 'repeating-linear-gradient(to right, #FFC72C 0 12px, transparent 12px 26px)' }}
      />
      {/* 小车 */}
      <div
        className="absolute top-[2px] transition-all duration-700 ease-out"
        style={{ left: `calc(${(Math.min(lit, 6) / 6) * 100}% - ${lit >= 6 ? 30 : 8}px)` }}
      >
        <svg viewBox="0 0 56 26" className="w-8 h-[18px]">
          <path d="M4 20 L8 10 Q9.5 6 14 6 L34 6 Q40 6 44 11 L50 16 Q53 17.5 53 20 L53 21 Q53 23 50 23 L8 23 Q4 23 4 20 Z" fill="#FFC72C" />
          <path d="M14 8 L32 8 L36 15 L11 15 Z" fill="#1B1F24" opacity=".85" />
          <circle cx="16" cy="23" r="4" fill="#1B1F24" /><circle cx="16" cy="23" r="1.6" fill="#f2f1ec" />
          <circle cx="43" cy="23" r="4" fill="#1B1F24" /><circle cx="43" cy="23" r="1.6" fill="#f2f1ec" />
        </svg>
      </div>
      {/* 里程碑桩 */}
      <div className="absolute inset-x-0 top-[16px] flex justify-between px-1">
        {posts.map((p, i) => (
          <div key={p} className="flex flex-col items-center w-9">
            <div
              className={`w-[30px] h-[30px] rounded-full flex items-center justify-center font-sign text-[15px] border-2.5 transition-all duration-500 ${
                i < lit
                  ? 'bg-hwy border-hwy-deep text-white'
                  : i === lit && waiting
                    ? 'bg-white border-mark text-mark-deep km-post-pulse'
                    : 'bg-[#e3e1d8] border-[#cfcdc4] text-faint'
              }`}
              style={i === lit && waiting ? { animation: 'kmPulse 1.4s ease-in-out infinite' } : undefined}
            >
              {p}
            </div>
          </div>
        ))}
      </div>
      {/* 终点旗 */}
      {done && (
        <div className="absolute -top-1 right-0 anim-in">
          <svg viewBox="0 0 20 24" className="w-5 h-6">
            <line x1="4" y1="1" x2="4" y2="23" stroke="#1B1F24" strokeWidth="2.5" />
            <polygon points="5,2 19,6.5 5,11" fill="#FFC72C" />
          </svg>
        </div>
      )}
    </div>
  )
}

/** 侧视小车剪影（档案卡用） */
export function CarGlyph({
  className = '',
  body = '#DEE4EA',
  glass = '#9fb3c4',
}: {
  className?: string
  body?: string
  glass?: string
}) {
  return (
    <svg viewBox="0 0 400 250" className={className} aria-hidden>
      <path d="M40 170 Q60 120 130 112 L300 108 Q360 112 372 150 L376 185 Q376 200 360 200 L52 200 Q38 200 40 185 Z" fill={body} />
      <path d="M130 112 L300 108 L296 150 L138 152 Z" fill={glass} />
      <circle cx="110" cy="200" r="26" fill="#1B1F24" />
      <circle cx="110" cy="200" r="12" fill="#6b727b" />
      <circle cx="310" cy="200" r="26" fill="#1B1F24" />
      <circle cx="310" cy="200" r="12" fill="#6b727b" />
      <rect x="372" y="152" width="6" height="14" rx="2" fill="#ff5a4e" />
    </svg>
  )
}

/** 车历长卷上的一个节点 */
export type JourneyPoint = { date: string; label: string; urgent?: boolean }

/**
 * 车历长卷 —— 首页 Hero 核心视觉（品牌叙事：识车之途）：
 * 把档案数据画成一条横贯的公路 —— 左侧是走过的每一步（点亮的事件桩），
 * 当前位置小车发光，右侧是识途盯着的前路（绿色预告牌，紧急项亮标线黄）。
 */
export function JourneyStrip({
  past,
  now,
  future,
  className = '',
}: {
  past: JourneyPoint[]
  now: { km: string; label?: string }
  future: JourneyPoint[]
  className?: string
}) {
  const pastLeft = (i: number) => (past.length <= 1 ? 7 : 7 + (i * 50) / (past.length - 1))
  const futureLeft = (i: number) => (future.length <= 1 ? 87 : 78 + (i * 18) / (future.length - 1))

  return (
    <div className={`relative mt-7 rounded-[14px] overflow-hidden border border-white/10 bg-asphalt-2/60 ${className}`}>
      {/* 长卷标题 */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-1 flex-wrap">
        <span className="sign sign-sm !rounded-[7px] px-2.5 py-[3px] font-sign text-[13px] tracking-[.08em] leading-none flex items-center h-[24px]">
          识车之途 · 车历长卷
        </span>
        <span className="text-[12px] text-white/45 tracking-[.04em]">← 走过的每一步，都已入档</span>
        <span className="text-[12px] text-white/45 tracking-[.04em] ml-auto">识途正盯着的前路 →</span>
      </div>

      {/* 公路 */}
      <div className="overflow-x-auto">
        <div className="relative h-[132px] min-w-[720px] mx-2 mb-2 rounded-[10px] bg-[#14181d]">
          {/* 沥青路面 */}
          <div className="absolute left-0 right-0 bottom-[18px] h-[34px] bg-[#1e232a] rounded-[6px]" />
          <div className="absolute left-0 right-0 bottom-[50px] h-[2px] bg-white/25" />
          <div className="absolute left-0 right-0 bottom-[20px] h-[2px] bg-white/25" />
          <div
            className="absolute left-0 right-0 bottom-[34px] h-[2px]"
            style={{ background: 'repeating-linear-gradient(to right, #FFC72C 0 16px, transparent 16px 34px)' }}
          />

          {/* 走过的路：事件桩 */}
          {past.map((p, i) => (
            <div key={`${p.date}-${p.label}`} className="absolute bottom-[52px] flex flex-col items-center" style={{ left: `${pastLeft(i)}%` }}>
              {i === 0 ? (
                <svg viewBox="0 0 20 24" className="w-[15px] h-[18px] mb-1">
                  <line x1="4" y1="1" x2="4" y2="23" stroke="#e8e6dd" strokeWidth="2.5" />
                  <polygon points="5,2 19,6.5 5,11" fill="#12A268" />
                </svg>
              ) : null}
              <span className="text-[11px] font-num text-mark/90 leading-none mb-1">{p.date}</span>
              <span className="text-[11px] text-white/65 leading-none mb-1.5 whitespace-nowrap">{p.label}</span>
              <span className="w-[3px] h-3 bg-white/35 rounded-full" />
              <span
                className="w-[7px] h-[7px] rounded-full bg-mark -mt-[1px]"
                style={{ boxShadow: '0 0 6px rgba(255,199,44,.8)' }}
              />
            </div>
          ))}

          {/* 当前位置：你的车 */}
          <div className="absolute bottom-[26px] -translate-x-1/2 flex flex-col items-center z-10" style={{ left: '66%' }}>
            <span
              className="font-num text-[15px] font-bold text-mark leading-none mb-1"
              style={{ textShadow: '0 0 10px rgba(255,199,44,.65)' }}
            >
              {now.km} km
            </span>
            <span className="text-[11px] text-white/60 leading-none mb-1">{now.label ?? '今天 · 此刻'}</span>
            <svg viewBox="0 0 56 26" className="w-11 h-[21px]">
              <ellipse cx="28" cy="24" rx="24" ry="2.5" fill="rgba(255,199,44,.25)" />
              <path d="M4 20 L8 10 Q9.5 6 14 6 L34 6 Q40 6 44 11 L50 16 Q53 17.5 53 20 L53 21 Q53 23 50 23 L8 23 Q4 23 4 20 Z" fill="#FFC72C" />
              <path d="M14 8 L32 8 L36 15 L11 15 Z" fill="#1B1F24" opacity=".85" />
              <circle cx="16" cy="23" r="4" fill="#1B1F24" />
              <circle cx="16" cy="23" r="1.6" fill="#f2f1ec" />
              <circle cx="43" cy="23" r="4" fill="#1B1F24" />
              <circle cx="43" cy="23" r="1.6" fill="#f2f1ec" />
            </svg>
          </div>

          {/* 前路：识途盯着的预告牌 */}
          {future.map((f) => (
            <div key={`${f.date}-${f.label}`} className="absolute bottom-[52px] -translate-x-1/2 flex flex-col items-center" style={{ left: `${futureLeft(future.indexOf(f))}%` }}>
              <span className="text-[11px] font-num text-white/70 leading-none mb-1">{f.date}</span>
              <span
                className={`px-2 py-[2px] rounded-[5px] text-[11.5px] leading-none whitespace-nowrap ${
                  f.urgent ? 'bg-mark text-asphalt font-bold' : 'bg-hwy text-white'
                }`}
                style={f.urgent ? { animation: 'kmPulse 1.6s ease-in-out infinite' } : undefined}
              >
                {f.label}
              </span>
              <span className="w-[3px] h-3 bg-white/35 rounded-full mt-1" />
            </div>
          ))}

          {/* 前路渐隐 */}
          <div
            className="absolute right-0 top-0 bottom-0 w-20 pointer-events-none"
            style={{ background: 'linear-gradient(to left, rgba(20,24,29,.95), transparent)' }}
          />
        </div>
      </div>
    </div>
  )
}
