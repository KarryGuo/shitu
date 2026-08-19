/**
 * 高德开放平台适配器（§0 原则 3：外部服务走适配器 + 环境变量切换）：
 * - 未配置 AMAP_KEY → 返回演示数据（source: 'sim'），接口契约与真实实现一致
 * - 配置 AMAP_KEY → 真实调用 restapi.amap.com（Web 服务 API · 周边搜索）
 * - 配置 AMAP_SIG（数字签名私钥）→ 请求自动携带 sig 参数（应用开启数字签名后必填）
 * - 调用失败 / 超时 → 降级演示数据并如实标注（与门店搜索降级语义一致）
 * 导航链接走 uri.amap.com（Web URI，无需 Key）。
 */
import { createHash } from 'node:crypto'

/**
 * 高德数字签名：应用开启「数字签名」后所有 Web 服务请求必须携带 sig。
 * 规则（官方）：请求参数按 key 字典序升序 → "k1=v1&k2=v2"（原始值，不 URL 编码）
 * → 末尾拼接私钥 → MD5（32 位小写）。未配置 AMAP_SIG 则返回 null（普通调用）。
 */
function amapSig(params: URLSearchParams): string | null {
  const secret = process.env.AMAP_SIG
  if (!secret) return null
  const qs = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  return createHash('md5').update(qs + secret, 'utf8').digest('hex')
}

export type NearbyKind = 'charging' | 'gas' | 'wash'

export interface NearbyPoi {
  name: string
  address: string
  distance: string
  tag: string
  /** "lng,lat"（高德坐标系） */
  location: string
  /** 高德导航 URI（点开即导航） */
  nav: string
}

export interface NearbyResult {
  kind: NearbyKind
  source: 'live' | 'sim'
  provider: string
  degraded: boolean
  note?: string
  pois: NearbyPoi[]
}

/** 演示定位：长沙市中心（与样例门店同城区） */
export const DEMO_LOCATION = '112.9832,28.1938'

/** 高德 POI 分类码（周边搜索 types 参数） */
const KIND_TYPES: Record<NearbyKind, string> = {
  charging: '011100', // 充电站
  gas: '010100', // 加油站
  wash: '011900', // 洗车/美容（部分城市类目码不同，配合关键词兜底）
}

const KIND_KEYWORDS: Record<NearbyKind, string> = {
  charging: '充电站',
  gas: '加油站',
  wash: '洗车',
}

/** 演示数据（未配置 AMAP_KEY 或真实调用失败时使用；nav 由 withNav 统一生成） */
const DEMO_POIS: Record<NearbyKind, Omit<NearbyPoi, 'nav'>[]> = {
  charging: [
    { name: '星星充电 · 万家丽广场站', address: '芙蓉区万家丽国际 MALL B1 停车场', distance: '1.2 km', tag: '快充 12 桩 · 峰谷电价', location: '113.0011,28.1873' },
    { name: '特来电 · 圭塘河公园站', address: '雨花区圭塘河沿岸停车场 A 区', distance: '2.1 km', tag: '快充 8 桩 · 带休息室', location: '112.9762,28.1792' },
    { name: '国家电网 · 雨花区政府站', address: '雨花区香樟东路 8 号', distance: '3.0 km', tag: '慢充 16 桩 · 夜间折扣', location: '113.0102,28.1713' },
  ],
  gas: [
    { name: '中国石化 · 万家丽加油站', address: '芙蓉区万家丽中路一段 88 号', distance: '1.5 km', tag: '92/95 号 · 24 小时', location: '113.0025,28.1906' },
    { name: '中国石油 · 香樟路加油站', address: '雨花区香樟路 255 号', distance: '2.4 km', tag: '92/95/0 号 · 有便利店', location: '112.9889,28.1701' },
  ],
  wash: [
    { name: '车靓靓精洗 · 体院路店', address: '天心区体院路 17 号', distance: '0.8 km', tag: '精洗 ¥39 · 排队少', location: '112.9801,28.1890' },
    { name: '驰加洗美中心', address: '雨花区劳动东路 402 号', distance: '2.2 km', tag: '洗 + 护套餐 ¥68', location: '112.9946,28.1755' },
  ],
}

/** 高德导航 URI（Web 端，免 Key；装了高德 App 会拉起，否则走网页导航） */
export function navUri(location: string, name: string): string {
  return `https://uri.amap.com/navigation?to=${encodeURIComponent(`${location},${name}`)}&mode=car&policy=1&coordinate=gaode&callnative=1&src=shitu`
}

function withNav(p: Omit<NearbyPoi, 'nav'>): NearbyPoi {
  return { ...p, nav: navUri(p.location, p.name) }
}

/** 演示结果（mock 默认路径） */
export function demoNearby(kind: NearbyKind, note?: string): NearbyResult {
  return {
    kind,
    source: 'sim',
    provider: 'demo-data',
    degraded: false,
    note: note ?? '未配置 AMAP_KEY，展示演示数据（配置后自动切换为高德实时结果）',
    pois: DEMO_POIS[kind].map(withNav),
  }
}

/**
 * 周边搜索：AMAP_KEY 存在 → 高德 Web 服务 API（3.5s 超时），失败降级演示数据。
 */
export async function nearbySearch(
  kind: NearbyKind,
  location: string = DEMO_LOCATION,
): Promise<NearbyResult> {
  const key = process.env.AMAP_KEY
  if (!key) return demoNearby(kind)

  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 3500)
  try {
    const params = new URLSearchParams({
      key,
      location,
      types: KIND_TYPES[kind],
      keywords: KIND_KEYWORDS[kind],
      radius: '5000',
      offset: '8',
      extensions: 'base',
    })
    const sig = amapSig(params)
    if (sig) params.set('sig', sig)
    const res = await fetch(`https://restapi.amap.com/v3/place/around?${params}`, { signal: ctl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const j = (await res.json()) as {
      status: string
      info?: string
      pois?: { name: string; address?: string[] | string; distance?: string; location: string; type?: string }[]
    }
    if (j.status !== '1') throw new Error(j.info ?? 'amap api error')
    const pois = (j.pois ?? []).map((p) => {
      const addr = Array.isArray(p.address) ? p.address.join('') : (p.address ?? '')
      const d = p.distance ? `${(Number(p.distance) / 1000).toFixed(1)} km` : '—'
      return withNav({ name: p.name, address: addr || '暂无地址', distance: d, tag: p.type?.split(';')[0] ?? KIND_KEYWORDS[kind], location: p.location })
    })
    if (!pois.length) throw new Error('empty pois')
    return { kind, source: 'live', provider: 'amap-open-platform', degraded: false, pois }
  } catch (e) {
    return {
      ...demoNearby(kind),
      degraded: true,
      note: `高德开放平台调用失败（${(e as Error).message}），已降级为演示数据`,
    }
  } finally {
    clearTimeout(timer)
  }
}
