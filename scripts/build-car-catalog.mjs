/**
 * 合并汽车之家（品牌+logo+车系）与懂车帝（真实车型版本，按年款分组）数据，
 * 生成前端 src/data/carCatalog.ts。
 *
 * 数据源：
 *  - %TEMP%/ah_brands_all.json  汽车之家按字母页解析（519 品牌 / 5166 车系，含 logo）
 *  - %TEMP%/dcd_specs.json      懂车帝车系车型列表（{brand, series, groups:[{y,t[]}]}）
 *
 * 用法：node scripts/build-car-catalog.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tmp = (f) => join(tmpdir(), f)
/* PowerShell Out-File 写入的 JSON 带 UTF-8 BOM，先剥离 */
const readJson = (f) => JSON.parse(readFileSync(tmp(f), 'utf8').replace(/^\uFEFF/, ''))
const ah = readJson('ah_brands_all.json')
const dcd = readJson('dcd_specs.json')

/* ---------- 名称归一化与品牌对齐 ---------- */
const norm = (s) => s.replace(/\s+/g, '').replace(/·/g, '').toLowerCase()

/* 汽车之家品牌索引（归一化名 → 品牌对象） */
const ahBrandByNorm = new Map(ah.map((b) => [norm(b.name), b]))

/** 懂车帝品牌名 → 汽车之家品牌名（归一化匹配 + 后缀剥离 + 别名） */
const ALIAS = {
  小鹏汽车: '小鹏', 奥迪audi: '奥迪', aito问界: 'AITO 问界', aito: 'AITO 问界',
  飞凡汽车: '飞凡', 五菱汽车: '五菱', 长安欧尚: '长安欧尚', 深蓝汽车: '深蓝',
  广汽埃安: '埃安', 埃安: '埃安', 吉利汽车: '吉利汽车', 理想汽车: '理想',
  蔚来: '蔚来', 智己汽车: '智己', 零跑汽车: '零跑', 哪吒汽车: '哪吒',
  岚图: '岚图', 极氪: '极氪', 长安汽车: '长安', 奇瑞汽车: '奇瑞',
  北京越野: '北京', arcfox极狐: '极狐', 魏牌: '魏牌', firefly萤火虫: '萤火虫',
}
const matchBrand = (dcdBrand) => {
  const nb = norm(dcdBrand)
  if (ALIAS[nb] && ahBrandByNorm.has(norm(ALIAS[nb]))) return ahBrandByNorm.get(norm(ALIAS[nb]))
  if (ahBrandByNorm.has(nb)) return ahBrandByNorm.get(nb)
  /* 后缀剥离：去掉"汽车/audi"等 */
  const stripped = nb.replace(/汽车$|audi$/, '')
  if (ahBrandByNorm.has(stripped)) return ahBrandByNorm.get(stripped)
  /* 双向包含：AITO问界 ⊃ 问界 / 飞凡汽车 ⊃ 飞凡 */
  for (const [k, v] of ahBrandByNorm) {
    if (k.includes(nb) || nb.includes(k)) return v
  }
  return null
}

/** 车系名匹配：精确 → 去品牌前缀（懂车帝"长安CS75" ↔ 汽车之家"CS75"） */
const matchSeries = (dcdBrandName, dcdSeriesName, ahSeriesList) => {
  const ns = norm(dcdSeriesName)
  const nb = norm(dcdBrandName)
  let hit = ahSeriesList.find((s) => norm(s.name) === ns)
  if (hit) return hit
  /* 懂车帝名去掉品牌前缀 */
  const stripped = ns.startsWith(nb) ? ns.slice(nb.length) : ns
  hit = ahSeriesList.find((s) => norm(s.name) === stripped)
  if (hit) return hit
  /* 汽车之家名去掉品牌前缀（懂车帝"高山" ↔ 汽车之家"魏牌高山"） */
  hit = ahSeriesList.find((s) => {
    const an = norm(s.name)
    return an === stripped || (an.startsWith(nb) && an.slice(nb.length) === stripped)
  })
  return hit ?? null
}

/* ---------- 懂车帝数据整理：年款分组去重 + 倒序 ---------- */
const cleanGroups = (groups) => {
  const merged = new Map()
  for (const g of groups) {
    const seen = merged.get(g.y) ?? new Set()
    for (const t of g.t) seen.add(t.trim())
    merged.set(g.y, seen)
  }
  return [...merged.entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([y, set]) => ({ y, t: [...set] }))
}

/* ---------- 合并 ----------
 * 1. 懂车帝条目先按归一化匹配定位到汽车之家品牌+车系，建立挂载索引
 * 2. 以汽车之家品牌/车系为主体输出（全量，含停售），挂载真实车型
 * 3. 懂车帝有而汽车之家没有的车系（新发布车型），追加到匹配品牌下
 */
const outBrands = []
let seriesTotal = 0
let trimTotal = 0
let matchedSeries = 0
let appended = 0

/* 汽车之家品牌名 → 车系数组（引用同一批对象，后面填充 trims） */
const ahSeriesByName = new Map(ah.map((b) => [b.name, b.series]))
/* 挂载索引：汽车之家车系对象 → 年款分组 */
const mounted = new Map()
/* 已消费的懂车帝条目 */
const consumed = new Set()

for (const s of dcd) {
  if (!s.groups || s.groups.length === 0) continue
  const ahBrand = matchBrand(s.brand)
  if (!ahBrand) continue
  const list = ahSeriesByName.get(ahBrand.name) ?? []
  const target = matchSeries(s.brand, s.series, list)
  if (target) {
    const prev = mounted.get(target)
    const groups = cleanGroups(s.groups)
    mounted.set(target, prev ? mergeGroups(prev, groups) : groups)
    consumed.add(s)
  }
}

/* 两组年款合并（同年款并集、倒序） */
function mergeGroups(a, b) {
  const map = new Map()
  for (const g of [...a, ...b]) {
    const seen = map.get(g.y) ?? new Set()
    for (const t of g.t) seen.add(t)
    map.set(g.y, seen)
  }
  return [...map.entries()]
    .sort((x, y) => Number(y[0]) - Number(x[0]))
    .map(([y, set]) => ({ y, t: [...set] }))
}

for (const b of ah) {
  const series = []
  for (const s of b.series) {
    const entry = { name: s.name }
    const groups = mounted.get(s)
    if (groups) {
      entry.trims = groups
      trimTotal += groups.reduce((a, g) => a + g.t.length, 0)
      matchedSeries++
    }
    series.push(entry)
    seriesTotal++
  }
  outBrands.push({
    letter: b.letter,
    name: b.name,
    logo: b.logo.startsWith('//') ? `https:${b.logo}` : b.logo,
    series,
  })
}

/* 第二轮：懂车帝未匹配车系（新发布车型）→ 追加到匹配品牌下 */
const brandSeriesIndex = new Map(outBrands.map((b) => [b.name, b]))
for (const s of dcd) {
  if (!s.groups || s.groups.length === 0 || consumed.has(s)) continue
  const ahBrand = matchBrand(s.brand)
  if (!ahBrand) continue
  const target = brandSeriesIndex.get(ahBrand.name)
  if (!target) continue
  if (matchSeries(s.brand, s.series, target.series)) continue
  const groups = cleanGroups(s.groups)
  if (groups.length === 0) continue
  target.series.push({ name: s.series, trims: groups })
  seriesTotal++
  trimTotal += groups.reduce((a, g) => a + g.t.length, 0)
  appended++
}

/* ---------- 燃料类型推断（车型名特征） ---------- */
const HEV_RE = /DM[-iIpP]|Hi4|DHT|增程|iDD|EM-P|PHEV|插混|混动|e-POWER|雷神|鲲鹏|C-DM|柠檬/i
const EV_RE = /EV\b|\d{3}km|纯电|e:(NP|NS)|ID\.|bZ|e-tron|LYRIQ|Mach-E|艾睿雅|微蓝|畅巡|MEGA|Cyberster|精灵#/i
const fuelOfTrimSrc = `const HEV_RE = ${HEV_RE.toString()}
const EV_RE = ${EV_RE.toString()}
export const fuelOfTrim = (t: string): '' | '纯电' | '混动' =>
  HEV_RE.test(t) ? '混动' : EV_RE.test(t) ? '纯电' : ''`

/* ---------- 生成 TS（紧凑行式） ---------- */
const lines = []
lines.push('/**')
lines.push(` * 车型库（自动生成，勿手改）：品牌 → 车系 → 车型版本（按年款分组）。`)
lines.push(` * 品牌/车系/logo：汽车之家车型库全量（${outBrands.length} 品牌 / ${seriesTotal} 车系，含停售）。`)
lines.push(` * 车型版本：懂车帝真实车型（${trimTotal} 条，${trimIndex.size} 个车系覆盖）；未覆盖车系按年款兜底。`)
lines.push(' * 生成脚本：scripts/build-car-catalog.mjs')
lines.push(' */')
lines.push('')
lines.push("export interface TrimGroup { year: string; names: string[] }")
lines.push("export interface SeriesInfo { name: string; trims?: TrimGroup[] }")
lines.push("export interface BrandInfo { letter: string; name: string; logo: string; series: SeriesInfo[] }")
lines.push('')
lines.push('/* 紧凑存档：l=letter n=name g=logo s=series(n=name t=trims[y=year]) */')
lines.push('const RAW: { l: string; n: string; g: string; s: { n: string; t?: { y: string; t: string[] }[] }[] }[] = [')

for (const b of outBrands) {
  const seriesParts = b.series.map((s) => {
    if (s.trims) {
      const groups = s.trims.map((g) => `{y:${JSON.stringify(g.year)},t:[${g.names.map((n) => JSON.stringify(n)).join(',')}]}`).join(',')
      return `{n:${JSON.stringify(s.name)},t:[${groups}]}`
    }
    return `{n:${JSON.stringify(s.name)}}`
  })
  lines.push(`{l:${JSON.stringify(b.letter)},n:${JSON.stringify(b.name)},g:${JSON.stringify(b.logo)},s:[${seriesParts.join(',')}]},`)
}
lines.push(']')
lines.push('')
lines.push(`export const BRANDS: BrandInfo[] = RAW.map((b) => ({
  letter: b.l,
  name: b.n,
  logo: b.g,
  series: b.s.map((s) => ({ name: s.n, trims: s.t?.map((g) => ({ year: g.y, names: g.t })) })),
}))

export const BRAND_INDEX = new Map(BRANDS.map((b) => [b.name, b]))

/** 品牌下的全部车系（含停售） */
export const getSeries = (brand: string): SeriesInfo[] => BRAND_INDEX.get(brand)?.series ?? []

/** 车系的按年款分组车型（无数据返回空数组，前端按年款兜底） */
export const getTrimGroups = (brand: string, series: string): TrimGroup[] =>
  getSeries(brand).find((s) => s.name === series)?.trims ?? []

/** 当前年份 */
export const CUR_YEAR = new Date().getFullYear()

/** 无真实车型数据的车系：按近 20 年生成年款选项（新→旧） */
export const fallbackYears = (): number[] => {
  const list: number[] = []
  for (let y = CUR_YEAR; y >= CUR_YEAR - 19; y--) list.push(y)
  return list
}

/** 从车型名推断燃料类型（空串 = 无法判断，由用户自选） */
${fuelOfTrimSrc}
`)

const out = lines.join('\n')
const dest = new URL('../apps/web/src/data/carCatalog.ts', import.meta.url)
writeFileSync(dest, out, 'utf8')

console.log(`brands: ${outBrands.length}, series: ${seriesTotal}, trims: ${trimTotal} (dcd series matched to AH: ${matched}/${trimIndex.size})`)
console.log(`written: ${dest.pathname} (${(out.length / 1024).toFixed(0)} KB)`)
