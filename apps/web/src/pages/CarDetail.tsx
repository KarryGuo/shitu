import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useApp } from '../stores/app'
import { useReveal } from '../hooks/useReveal'
import { SectionHead, DarkStat } from '../components/ui'
import { Gauge, CarGlyph } from '../components/art'
import { api, type NearbyResult } from '../api/client'

const typeMeta: Record<string, { label: string; cls: string }> = {
  maintenance: { label: '保养', cls: 'bg-hwy-tint text-hwy-deep' },
  repair: { label: '维修', cls: 'bg-[#F7EED8] text-[#8C6A1E]' },
  accident: { label: '事故', cls: 'bg-[#F9E9E2] text-[#B4552D]' },
  claim: { label: '理赔', cls: 'bg-[#E8EEF4] text-[#3A6B8C]' },
  part: { label: '配件', cls: 'bg-concrete-2 text-sub' },
}

/** 周边服务类目（高德适配器：充电 / 加油 / 洗车） */
const KINDS = [
  { id: 'charging', label: '充电桩', icon: '⚡' },
  { id: 'gas', label: '加油站', icon: '⛽' },
  { id: 'wash', label: '洗车', icon: '🫧' },
] as const

function NearbyCard() {
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('charging')
  const [data, setData] = useState<Partial<Record<string, NearbyResult>>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const current = data[kind]
  const pick = async (k: (typeof KINDS)[number]['id']) => {
    setKind(k)
    if (data[k]) return
    setLoading(true)
    setError(null)
    try {
      const r = await api.getNearby(k)
      setData((d) => ({ ...d, [k]: r }))
    } catch {
      setError('周边服务暂不可用（后端未启动或网络异常）')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-6 md:p-7 reveal">
      <div className="flex flex-wrap items-center gap-3">
        {KINDS.map((k) => (
          <button
            key={k.id}
            onClick={() => void pick(k.id)}
            className={`tool-chip ${kind === k.id ? 'done' : ''} ${kind === k.id && loading ? 'running' : ''}`}
          >
            <span>{k.icon}</span> {k.label}
          </button>
        ))}
        {current && (
          <span
            className={`ml-auto text-[12px] font-bold rounded-full px-3 py-1 ${
              current.source === 'live'
                ? 'bg-[#E3F1E6] text-[#2E7D46]'
                : 'bg-concrete-2 text-sub'
            }`}
            title={current.note}
          >
            {current.source === 'live' ? `高德开放平台 · 实时` : '演示数据 · AMAP_KEY 未配置'}
          </span>
        )}
      </div>

      <div className="mt-4 min-h-[120px]">
        {loading && <div className="text-sub text-[14px] py-6 text-center">正在查询周边…</div>}
        {error && <div className="text-[#B4552D] text-[14px] py-6 text-center">{error}</div>}
        {current && !loading && (
          <>
            {current.degraded && current.note && (
              <div className="text-[13px] text-[#8C6A1E] bg-[#F7EED8] rounded-lg px-3.5 py-2 mb-3">
                ⚠ {current.note}
              </div>
            )}
            <div className="flex flex-col">
              {current.pois.map((p) => (
                <div key={p.name} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 border-b border-line last:border-0">
                  <b className="text-[15.5px]">{p.name}</b>
                  <span className="num text-mark text-[14px] font-bold">{p.distance}</span>
                  <span className="text-faint text-[12.5px] bg-concrete-2 rounded-md px-2 py-0.5">{p.tag}</span>
                  <p className="text-sub text-[13.5px] w-full">{p.address}</p>
                  <a
                    href={p.nav}
                    target="_blank"
                    rel="noreferrer"
                    className="text-hwy text-[13.5px] font-bold hover:underline mt-0.5"
                  >
                    导航前往 ↗
                  </a>
                </div>
              ))}
            </div>
          </>
        )}
        {!current && !loading && !error && (
          <div className="text-sub text-[14px] py-6 text-center">点击上方类目，查询车辆周边 5 km 内的实时服务。</div>
        )}
      </div>
      <div className="text-sub text-[12.5px] mt-3">
        数据来源：高德开放平台周边搜索（配置 AMAP_KEY 即实时）· 导航直达高德地图。
      </div>
    </div>
  )
}

export default function CarDetail() {
  const { id } = useParams()
  const cars = useApp((s) => s.cars)
  const car = cars.find((c) => c.static.id === id) ?? cars[0]
  const revealRef = useReveal()

  const s = car.static
  const st = car.state
  const events = [...car.events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  const cycleUsed = st.mileage - (st.lastMaintenanceMileage ?? 0)
  const daysToInspection = Math.max(
    0,
    Math.round((new Date(st.inspectionExpiry).getTime() - new Date('2026-08-18').getTime()) / 86400000),
  )

  return (
    <div ref={revealRef} className="pb-10">
      {/* ===== 车辆 Hero：沥青档案板 ===== */}
      <div className="ink-card relative overflow-hidden p-6 md:p-9 anim-up">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link to="/cars" className="text-[13.5px] text-white/50 hover:text-mark transition-colors">
              ← 返回车辆列表
            </Link>
            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <span className="plate">{s.plateNo}</span>
              <span className="text-white/45 text-[14px]">家庭自用</span>
            </div>
            <h1 className="font-display text-[24px] md:text-[30px] mt-3.5">
              {s.year} 款 · {s.model}
            </h1>
            <div className="text-white/55 text-[14.5px] mt-1">
              {s.brand} · {s.fuelType} · 购车于 {s.purchaseDate}
            </div>
          </div>
          <CarGlyph className="w-48 h-28 opacity-75 hidden sm:block" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-7">
          <DarkStat value={st.mileage.toLocaleString()} label={`里程 km · 更新于 ${st.mileageAt}`} delay={60} />
          <DarkStat value={st.lastMaintenanceMileage?.toLocaleString() ?? '—'} label="上次保养时里程 km" delay={140} />
          <DarkStat value={st.insuranceExpiry} label="保险到期" delay={220} />
          <DarkStat value={st.inspectionExpiry} label="年检到期" delay={300} />
        </div>
      </div>

      {/* ===== 静态域 ===== */}
      <section className="mt-10">
        <SectionHead kicker="STATIC · 静态域" title="一次录入，长期有效" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {[
            ['车牌号', s.plateNo],
            ['品牌车系', s.brand],
            ['年款', `${s.year} 款`],
            ['燃料类型', s.fuelType],
            ['购车日期', s.purchaseDate],
            ['使用性质', '家庭自用'],
            ['保险周期', '一年一续'],
            ['年检规则', '六年內两年一检'],
          ].map(([k, v], i) => (
            <div key={k} className="card reveal px-5 py-4" style={{ transitionDelay: `${i * 60}ms` }}>
              <div className="text-[12.5px] text-faint tracking-[.08em]">{k}</div>
              <div className="font-bold text-[16px] mt-1">{v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== 动态域：双仪表台 ===== */}
      <section className="mt-10">
        <SectionHead kicker="DYNAMIC · 动态域" title="持续更新，驱动主动提醒" />
        <div className="card p-6 md:p-7 reveal">
          <div className="grid md:grid-cols-[auto_auto_1fr] gap-6 items-center justify-items-center md:justify-items-start">
            <Gauge value={cycleUsed} max={10000} label="本保养周期已行驶" unit="km" />
            <Gauge value={daysToInspection} max={90} label="距年检剩余" unit="天" />
            <div className="flex flex-col gap-2.5 justify-center w-full">
              <div className="flex justify-between items-baseline text-[15px]">
                <span className="text-sub">保险到期</span>
                <b className="num text-[18px]">{st.insuranceExpiry}</b>
              </div>
              <hr className="lane" />
              <div className="flex justify-between items-baseline text-[15px]">
                <span className="text-sub">上次保养</span>
                <b className="num text-[18px]">{st.lastMaintenanceAt}</b>
              </div>
              <hr className="lane" />
              <div className="flex justify-between items-baseline text-[15px]">
                <span className="text-sub">违章状态</span>
                <b className="text-hwy text-[15px] font-bold">未发现违章</b>
              </div>
            </div>
          </div>
          <div className="text-sub text-[13px] mt-4 text-center md:text-left">
            里程更新于 {st.mileageAt} · 手动录入 / 单据识别 —— 到期日与周期全部来自档案，主动提醒由此驱动。
          </div>
        </div>
      </section>

      {/* ===== 周边服务（高德适配器：mock 默认 + AMAP_KEY 实时切换） ===== */}
      <section className="mt-10">
        <SectionHead
          kicker="TOOLS · 周边服务"
          title="高德地图工具箱"
          sub="经后端适配器调用高德开放平台周边搜索：未配置 AMAP_KEY 时返回同构演示数据，配置后同一接口自动切换为实时 POI，导航直达高德地图。"
        />
        <NearbyCard />
      </section>

      {/* ===== 事件域：里程碑履历 ===== */}
      <section className="mt-10">
        <SectionHead
          kicker="EVENTS · 事件域"
          title="完整履历，就是车况的最好证明"
          sub="每一次保养、维修、理赔都会回写档案；换车估值时，这份履历直接成为议价依据。"
        />
        <div className="card p-6 md:p-7 reveal">
          <div className="flex flex-col">
            {events.map((e, i) => {
              const m = typeMeta[e.type]
              return (
                <div key={e.id} className="flex gap-4">
                  <div className="relative flex flex-col items-center w-[14px] shrink-0">
                    {/* 沥青路肩 + 黄虚线 */}
                    <div className="absolute top-0 bottom-0 w-[10px] rounded-full bg-asphalt" />
                    {i < events.length - 1 && (
                      <div
                        className="absolute top-[14px] bottom-[-10px] w-[2px] z-10"
                        style={{ background: 'repeating-linear-gradient(to bottom, #FFC72C 0 6px, transparent 6px 14px)' }}
                      />
                    )}
                    <div
                      className={`relative z-20 mt-1 w-[10px] h-[10px] rounded-full border-2 border-white ${i === 0 ? 'bg-mark' : 'bg-asphalt-3'}`}
                      style={{ boxShadow: '0 0 0 2px var(--concrete)' }}
                    />
                  </div>
                  <div className="flex-1 pb-7 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className={`text-[12.5px] font-bold rounded-md px-2 py-0.5 ${m.cls}`}>{m.label}</span>
                    <b className="text-[16px]">{e.title}</b>
                    <span className="num text-faint text-[13.5px]">{e.occurredAt}</span>
                    <p className="text-sub text-[14.5px] w-full">{e.detail}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
