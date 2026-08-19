import { useEffect, useMemo, useRef, useState } from 'react'
import type { BrandInfo, SeriesInfo } from '../data/carCatalog'

/**
 * 三级联动选择器（品牌 → 车系 → 车型年款）。
 * 品牌面板：按首字母 A→Z 分组，logo 在左、品牌名在右，支持关键字过滤；
 * 车系面板：当前品牌下全部车系（含停售）；车型面板：按年款分组展示全部版本。
 */

/* ---------- 品牌徽标：外链 logo 失效时回退为首字徽章 ---------- */
export function BrandLogo({ name, logo, size = 26 }: { name: string; logo?: string; size?: number }) {
  const [err, setErr] = useState(false)
  const text = name.replace(/[^\u4e00-\u9fa5A-Za-z]/g, '').slice(0, 1) || '?'
  if (!logo || err) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-[6px] bg-hwy-tint text-hwy-deep font-bold shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.5 }}
      >
        {text}
      </span>
    )
  }
  return (
    <img
      src={logo}
      alt={name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setErr(true)}
      className="rounded-[6px] object-contain shrink-0 bg-white"
      style={{ width: size, height: size }}
    />
  )
}

/* ---------- 通用弹层：点击外部关闭 ---------- */
function useClickOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return ref
}

/* ---------- 触发器外观 ---------- */
function Trigger({
  label, placeholder, logo, open, disabled, onToggle,
}: {
  label?: string
  placeholder: string
  logo?: string
  open: boolean
  disabled?: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`field flex items-center gap-2.5 text-left ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${open ? '!border-hwy' : ''}`}
    >
      {label ? (
        <>
          {logo !== undefined && <BrandLogo name={label} logo={logo} size={22} />}
          <span className="truncate flex-1">{label}</span>
        </>
      ) : (
        <span className="text-faint flex-1">{placeholder}</span>
      )}
      <span className={`text-faint text-[11px] transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
    </button>
  )
}

/* ================= 品牌选择器 ================= */

export function BrandPicker({
  brands, value, onChange,
}: {
  brands: BrandInfo[]
  value: string
  onChange: (brand: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [kw, setKw] = useState('')
  const ref = useClickOutside(() => setOpen(false))
  const selected = brands.find((b) => b.name === value)

  /* 关键字过滤后的品牌（按字母分组保持 A→Z 顺序） */
  const groups = useMemo(() => {
    const filtered = kw.trim() ? brands.filter((b) => b.name.toLowerCase().includes(kw.trim().toLowerCase())) : brands
    const map = new Map<string, BrandInfo[]>()
    for (const b of filtered) {
      const list = map.get(b.letter) ?? []
      list.push(b)
      map.set(b.letter, list)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [brands, kw])

  return (
    <div className="relative" ref={ref}>
      <Trigger
        label={selected?.name}
        logo={selected?.logo}
        placeholder="选择品牌"
        open={open}
        onToggle={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 card !p-0 overflow-hidden shadow-[0_18px_40px_-12px_rgba(15,40,80,.35)]">
          {/* 搜索框 */}
          <div className="p-2.5 border-b border-line sticky top-0 bg-paper z-10">
            <input
              autoFocus
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="搜索品牌，如：比亚迪 / BMW"
              className="w-full border border-line rounded-[8px] px-3 py-2 text-[14px] bg-white focus:outline-none focus:border-hwy"
            />
          </div>
          {/* 字母分组列表 */}
          <div className="max-h-[300px] overflow-y-auto">
            {groups.length === 0 && (
              <div className="text-faint text-[13.5px] text-center py-6">没有匹配的品牌，可在下方选择手动输入</div>
            )}
            {groups.map(([letter, list]) => (
              <div key={letter}>
                <div className="px-3.5 pt-2.5 pb-1 text-[11.5px] font-black tracking-[.12em] text-hwy bg-hwy-tint/40 sticky top-0">
                  {letter}
                </div>
                <div className="grid grid-cols-2">
                  {list.map((b) => (
                    <button
                      key={b.name}
                      type="button"
                      onClick={() => {
                        onChange(b.name)
                        setOpen(false)
                        setKw('')
                      }}
                      className={`flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-hwy-tint/60 transition-colors ${value === b.name ? 'bg-hwy-tint font-bold' : ''}`}
                    >
                      <BrandLogo name={b.name} logo={b.logo} size={26} />
                      <span className="text-[14px] truncate">{b.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {/* 底部常驻：其他 / 未列出 */}
            <button
              type="button"
              onClick={() => {
                onChange('其他')
                setOpen(false)
                setKw('')
              }}
              className="w-full px-3.5 py-2.5 text-left text-[13.5px] text-sub hover:bg-hwy-tint/60 border-t border-line"
            >
              其他 / 未列出（手动输入）
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ================= 车系选择器 ================= */

export function SeriesPicker({
  series, value, onChange, disabled,
}: {
  series: SeriesInfo[]
  value: string
  onChange: (series: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [kw, setKw] = useState('')
  const ref = useClickOutside(() => setOpen(false))

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase()
    return k ? series.filter((s) => s.name.toLowerCase().includes(k)) : series
  }, [series, kw])

  return (
    <div className="relative" ref={ref}>
      <Trigger
        label={value || undefined}
        placeholder={disabled ? '请先选择品牌' : '选择车系'}
        open={open}
        disabled={disabled}
        onToggle={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 card !p-0 overflow-hidden shadow-[0_18px_40px_-12px_rgba(15,40,80,.35)]">
          <div className="p-2.5 border-b border-line">
            <input
              autoFocus
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="搜索车系"
              className="w-full border border-line rounded-[8px] px-3 py-2 text-[14px] bg-white focus:outline-none focus:border-hwy"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-faint text-[13.5px] text-center py-6">没有匹配的车系</div>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => {
                    onChange(s.name)
                    setOpen(false)
                    setKw('')
                  }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-hwy-tint/60 transition-colors ${value === s.name ? 'bg-hwy-tint font-bold' : ''}`}
                >
                  <span className="text-[14px] truncate flex-1">{s.name}</span>
                  {s.trims && s.trims.length > 0 && (
                    <span className="badge-soft !text-[11px] shrink-0">{s.trims.length} 个年款</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ================= 车型（年款版本）选择器 ================= */

export function TrimPicker({
  trims, value, onChange, disabled, fallbackYears,
}: {
  /** 按年款分组的车型版本（真实数据） */
  trims: { year: string; names: string[] }[]
  value: string
  onChange: (trim: string) => void
  disabled?: boolean
  /** 无真实数据时按年款区间生成选项 */
  fallbackYears?: number[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(() => setOpen(false))

  const groups = trims.length > 0 ? trims : fallbackYears && fallbackYears.length > 0 ? [{ year: '年款', names: fallbackYears.map(String) }] : []
  const label = value || undefined

  return (
    <div className="relative" ref={ref}>
      <Trigger
        label={label}
        placeholder={disabled ? '请先选择车系' : '选择车型 / 年款'}
        open={open}
        disabled={disabled}
        onToggle={() => setOpen((v) => !v)}
      />
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 card !p-0 overflow-hidden shadow-[0_18px_40px_-12px_rgba(15,40,80,.35)]">
          <div className="max-h-[300px] overflow-y-auto">
            {groups.length === 0 ? (
              <div className="text-faint text-[13.5px] text-center py-6">该车系暂无车型数据</div>
            ) : (
              groups.map((g) => (
                <div key={g.year}>
                  <div className="px-3.5 pt-2.5 pb-1 text-[11.5px] font-black tracking-[.12em] text-hwy bg-hwy-tint/40">
                    {g.year !== '年款' ? `${g.year}款` : '选择年款'}
                  </div>
                  {g.names.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        onChange(n)
                        setOpen(false)
                      }}
                      className={`w-full px-3.5 py-2 text-left text-[13.5px] hover:bg-hwy-tint/60 transition-colors truncate ${value === n ? 'bg-hwy-tint font-bold' : ''}`}
                    >
                      {g.year !== '年款' ? `${g.year}款 ${n}` : `${n}款`}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
