import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useApp } from '../stores/app'
import { useReveal } from '../hooks/useReveal'
import { SectionHead, DarkStat, NoCarGuard } from '../components/ui'
import { Gauge, CarGlyph } from '../components/art'
import { api, mapUrl, type NearbyResult, type LocateResult } from '../api/client'

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

type KindId = (typeof KINDS)[number]['id']

/* ---------- WGS-84（浏览器定位）→ GCJ-02（高德坐标系）转换 ---------- */
const GCJ = { PI: 3.141592653589793, A: 6378245.0, EE: 0.00669342162296594323 }

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * GCJ.PI) + 20.0 * Math.sin(2.0 * x * GCJ.PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(y * GCJ.PI) + 40.0 * Math.sin((y / 3.0) * GCJ.PI)) * 2.0) / 3.0
  ret += ((160.0 * Math.sin((y / 12.0) * GCJ.PI) + 320.0 * Math.sin((y * GCJ.PI) / 30.0)) * 2.0) / 3.0
  return ret
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * GCJ.PI) + 20.0 * Math.sin(2.0 * x * GCJ.PI)) * 2.0) / 3.0
  ret += ((20.0 * Math.sin(x * GCJ.PI) + 40.0 * Math.sin((x / 3.0) * GCJ.PI)) * 2.0) / 3.0
  ret += ((150.0 * Math.sin((x / 12.0) * GCJ.PI) + 300.0 * Math.sin((x / 30.0) * GCJ.PI)) * 2.0) / 3.0
  return ret
}

/** 境外坐标原样返回（国测局偏移算法仅适用于境内） */
function wgs84ToGcj02(lng: number, lat: number): [number, number] {
  if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return [lng, lat]
  let dLat = transformLat(lng - 105.0, lat - 35.0)
  let dLng = transformLng(lng - 105.0, lat - 35.0)
  const radLat = (lat / 180.0) * GCJ.PI
  let magic = Math.sin(radLat)
  magic = 1 - GCJ.EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / (((GCJ.A * (1 - GCJ.EE)) / (magic * sqrtMagic)) * GCJ.PI)
  dLng = (dLng * 180.0) / ((GCJ.A / sqrtMagic) * Math.cos(radLat) * GCJ.PI)
  return [lng + dLng, lat + dLat]
}

/* ---------- 定位来源徽标 ---------- */
const locSourceMeta: Record<LocateResult['source'], { label: string; cls: string }> = {
  gps: { label: '精准定位', cls: 'bg-[#E3F1E6] text-[#2E7D46]' },
  ip: { label: '网络定位 · 城市级', cls: 'bg-[#F7EED8] text-[#8C6A1E]' },
  default: { label: '默认位置', cls: 'bg-concrete-2 text-sub' },
}

function NearbyCard() {
  const [kind, setKind] = useState<KindId>('charging')
  const [loc, setLoc] = useState<LocateResult | null>(null)
  const [locating, setLocating] = useState(true)
  const [data, setData] = useState<Record<string, NearbyResult>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapFailed, setMapFailed] = useState(false)

  /** 自动定位：浏览器精准定位（WGS-84→GCJ-02，后端逆地理出地址）→ 失败降级按 IP 定位 → 再兜底默认位置 */
  const runLocate = useCallback(async () => {
    setLocating(true)
    let done = false
    const finish = (r: LocateResult | null) => {
      if (!done) {
        done = true
        setLoc(r)
        setLocating(false)
      }
    }
    const locateByIp = async () => {
      try {
        finish(await api.locate())
      } catch {
        finish(null)
      }
    }
    if (!navigator.geolocation) return void locateByIp()
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const [lng, lat] = wgs84ToGcj02(pos.coords.longitude, pos.coords.latitude)
        try {
          finish(await api.locate(lng, lat))
        } catch {
          finish({ source: 'gps', location: `${lng.toFixed(6)},${lat.toFixed(6)}`, address: `当前位置（${lng.toFixed(5)}, ${lat.toFixed(5)}）` })
        }
      },
      () => void locateByIp(),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    )
    // 浏览器定位超时兜底（getCurrentPosition 的 timeout 事件个别浏览器不触发）
    setTimeout(() => {
      if (!done) void locateByIp()
    }, 9000)
  }, [])

  useEffect(() => {
    void runLocate()
  }, [runLocate])

  /** 缓存键 = 类目 + 定位点（定位更新后自动按新位置重查） */
  const cacheKey = (k: KindId) => `${k}@${loc?.location ?? ''}`
  const current = data[cacheKey(kind)]

  const pick = useCallback(
    async (k: KindId) => {
      setKind(k)
      if (data[cacheKey(k)]) return
      setLoading(true)
      setError(null)
      try {
        const r = await api.getNearby(k, loc?.location)
        setData((d) => ({ ...d, [cacheKey(k)]: r }))
      } catch {
        setError('周边服务暂不可用（网络异常），请稍后重试')
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loc, data],
  )

  /** 定位完成后自动查询默认类目（最近的充电桩） */
  useEffect(() => {
    if (loc) void pick('charging')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc?.location])

  /** 地图背景：以用户位置为中心，标注当前位置（红）+ 周边服务商（蓝） */
  const poiLocs = current?.pois.map((p) => p.location) ?? []
  const src = loc ? mapUrl(loc.location, poiLocs, 14) : null

  return (
    <div className="card overflow-hidden reveal">
      {/* ===== 高德地图背景（显示当前位置与周边服务商） ===== */}
      <div className="relative h-[240px] md:h-[280px] bg-asphalt">
        {src && !mapFailed ? (
          <img
            src={src}
            alt="当前位置周边地图"
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setMapFailed(true)}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(160deg, #232a33 0%, #2b333d 55%, #1d232b 100%)',
            }}
          >
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)',
                backgroundSize: '44px 44px',
              }}
            />
          </div>
        )}
        {/* 压暗渐变，保证文字可读 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/30" />

        {/* 顶部：当前位置信息 */}
        <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center gap-2">
          <span className="bg-black/55 backdrop-blur-sm text-white text-[13px] font-semibold rounded-full px-3.5 py-1.5 leading-none flex items-center gap-1.5">
            <span className="text-mark">📍</span>
            {locating ? '正在定位当前位置…' : (loc?.address ?? '定位暂不可用')}
          </span>
          {loc && !locating && (
            <span className={`text-[11.5px] font-bold rounded-full px-2.5 py-1 ${locSourceMeta[loc.source].cls}`}>
              {locSourceMeta[loc.source].label}
            </span>
          )}
          <button
            className="ml-auto bg-black/55 backdrop-blur-sm text-white/90 text-[12px] font-bold rounded-full px-3 py-1.5 leading-none hover:bg-black/75 transition-colors"
            onClick={() => void runLocate()}
            title="重新获取当前位置"
          >
            ⟳ 重新定位
          </button>
        </div>
        {loc?.note && (
          <div className="absolute top-[52px] left-4 text-white/80 text-[11.5px] bg-black/45 rounded-full px-3 py-1">
            {loc.note}
          </div>
        )}

        {/* 底部：服务类目选项卡（叠加在地图上） */}
        <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center gap-2.5">
          {KINDS.map((k) => (
            <button
              key={k.id}
              onClick={() => void pick(k.id)}
              disabled={locating}
              className={`tool-chip !px-3.5 !py-2 !text-[13.5px] shadow-[0_2px_10px_rgba(0,0,0,.35)] ${
                kind === k.id ? 'done' : ''
              } ${kind === k.id && loading ? 'running' : ''} ${locating ? 'opacity-60' : ''}`}
            >
              <span>{k.icon}</span> {k.label}
            </button>
          ))}
          {current && (
            <span
              className={`ml-auto text-[11.5px] font-bold rounded-full px-3 py-1.5 ${
                current.source === 'live' ? 'bg-[#E3F1E6] text-[#2E7D46]' : 'bg-black/55 text-white/85 backdrop-blur-sm'
              }`}
              title={current.note}
            >
              {current.source === 'live' ? '高德开放平台 · 实时' : '内置示例'}
            </span>
          )}
        </div>
      </div>

      {/* ===== POI 列表（按距离最近优先） ===== */}
      <div className="p-5 md:p-6 min-h-[120px]">
        {loading && <div className="text-sub text-[14px] py-6 text-center">正在按当前位置查询周边最近的服务商…</div>}
        {error && <div className="text-[#B4552D] text-[14px] py-6 text-center">{error}</div>}
        {current && !loading && (
          <>
            {current.note && (
              <div className={`text-[13px] rounded-lg px-3.5 py-2 mb-3 ${current.degraded ? 'text-[#8C6A1E] bg-[#F7EED8]' : 'text-sub bg-concrete-2'}`}>
                {current.degraded ? '⚠ ' : ''}
                {current.note}
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
          <div className="text-sub text-[14px] py-6 text-center">
            {locating ? '定位完成后将自动查询周边充电桩。' : '点击上方类目，查询当前位置周边 5 km 内最近的服务商。'}
          </div>
        )}
      </div>
      <div className="text-sub text-[12.5px] px-5 md:px-6 pb-5">
        定位与周边搜索由高德开放平台提供（浏览器精准定位，失败自动降级网络定位）· 结果按距离最近优先 · 导航直达高德地图。
      </div>
    </div>
  )
}

export default function CarDetail() {
  const { id } = useParams()
  const cars = useApp((s) => s.cars)
  const revealRef = useReveal()

  // 空车库守卫：无档案时引导建档（数据由车主自己录入，识途不预填）
  if (cars.length === 0) return <NoCarGuard scene="查看车辆档案" />

  const car = cars.find((c) => c.static.id === id) ?? cars[0]

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

      {/* ===== 周边服务（高德适配器：自动定位 + 实时周边搜索） ===== */}
      <section className="mt-10">
        <SectionHead
          kicker="TOOLS · 周边服务"
          title="高德地图工具箱"
          sub="自动获取当前位置（浏览器精准定位，失败自动降级网络定位），按当前位置实时搜索周边 5 km 内最近的服务商，地图底图直观呈现，导航直达高德地图。"
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
