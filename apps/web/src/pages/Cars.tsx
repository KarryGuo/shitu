import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp, isDemoAccount, type CarFormInput } from '../stores/app'
import { useReveal } from '../hooks/useReveal'
import { SectionHead, DarkStat } from '../components/ui'
import { Gauge, CarGlyph, JourneyStrip, type JourneyPoint } from '../components/art'
import { Icons } from '../components/AppShell'
import { api, type AskResult } from '../api/client'
import { BRANDS, getModels, getModelYears, yearOptions, fuelOf, CATALOG_SIZE } from '../data/carModels'

/* ===== 对话式入口：说什么都行，识途基于档案回答并给出行动 ===== */

const SUGGESTED = ['我的车最近要注意什么？', '保养大概要花多少钱？', '剐蹭了怎么办？']

interface ChatTurn {
  role: 'user' | 'agent'
  text: string
  result?: AskResult
}

function AskCard() {
  const navigate = useNavigate()
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [showFacts, setShowFacts] = useState(false)

  const ask = async (q: string) => {
    const question = q.trim()
    if (!question || busy) return
    setTurns((t) => [...t, { role: 'user', text: question }])
    setInput('')
    setBusy(true)
    try {
      const result = await api.ask(question)
      setTurns((t) => [...t, { role: 'agent', text: result.text, result }])
    } catch {
      setTurns((t) => [...t, { role: 'agent', text: '后端暂时连不上，请稍后再试。' }])
    } finally {
      setBusy(false)
    }
  }

  const last = [...turns].reverse().find((t) => t.role === 'agent' && t.result)?.result

  return (
    <div className="card p-6 md:p-7 reveal">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="kicker !text-hwy">ASK · 问识途</span>
        <span className="text-faint text-[12.5px]">基于车辆档案回答 · 说什么都行</span>
      </div>

      {/* 建议问题 */}
      <div className="flex flex-wrap gap-2.5 mt-4">
        {SUGGESTED.map((s) => (
          <button key={s} className="tool-chip" onClick={() => void ask(s)} disabled={busy}>
            {s}
          </button>
        ))}
      </div>

      {/* 对话流 */}
      {turns.length > 0 && (
        <div className="flex flex-col gap-3 mt-5">
          {turns.map((t, i) =>
            t.role === 'user' ? (
              <div key={i} className="self-end max-w-[85%] bg-hwy text-white rounded-[14px] rounded-br-[4px] px-4 py-2.5 text-[14.5px]">
                {t.text}
              </div>
            ) : (
              <div key={i} className="self-start max-w-[92%] bg-concrete rounded-[14px] rounded-bl-[4px] px-4 py-3">
                <p className="text-[14.5px] whitespace-pre-line leading-relaxed">{t.text}</p>
                {t.result?.degraded && t.result.note && (
                  <p className="text-[12.5px] text-[#8C6A1E] mt-1.5">⚠ {t.result.note}</p>
                )}
              </div>
            ),
          )}
          {busy && (
            <div className="self-start bg-concrete rounded-[14px] rounded-bl-[4px] px-4 py-3 text-[14px] text-sub">
              识途正在翻档案…
            </div>
          )}
        </div>
      )}

      {/* 行动建议 + 依据 */}
      {last && !busy && (
        <div className="mt-4 flex flex-col gap-3">
          {last.actions.length > 0 && (
            <div className="flex flex-wrap gap-2.5">
              {last.actions.map((a) => (
                <button
                  key={a.label}
                  className="btn btn-bronze !py-2 !px-4 !text-[14px]"
                  onClick={() =>
                    navigate(a.kind === 'care' ? '/care' : a.kind === 'claim' ? '/claim' : `/cars/${useApp.getState().cars[0]?.static.id ?? ''}`)
                  }
                >
                  {a.label} →
                </button>
              ))}
            </div>
          )}
          <button className="text-left text-faint text-[12.5px] hover:text-sub" onClick={() => setShowFacts((v) => !v)}>
            {showFacts ? '收起依据' : '回答依据（档案事实）'} {showFacts ? '▲' : '▼'}
          </button>
          {showFacts && (
            <ul className="text-sub text-[13px] flex flex-col gap-1 pl-1">
              {last.facts.map((f, i) => (
                <li key={i}>· {f}</li>
              ))}
            </ul>
          )}
          <div className="text-faint text-[11.5px]">
            生成：{last.provider}
            {last.degraded ? '（降级）' : ''} · 事实来自车辆档案，LLM 只负责表达
          </div>
        </div>
      )}

      {/* 输入框 */}
      <form
        className="mt-5 flex gap-2.5"
        onSubmit={(e) => {
          e.preventDefault()
          void ask(input)
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="例如：下个月我要跑长途，该检查什么？"
          className="flex-1 border border-line rounded-[10px] px-4 py-2.5 text-[14.5px] bg-paper focus:outline-none focus:border-hwy"
          maxLength={500}
        />
        <button type="submit" className="btn btn-ink !py-2 !px-5 !text-[14px]" disabled={busy || !input.trim()}>
          问识途
        </button>
      </form>
    </div>
  )
}

const kindLabel: Record<string, string> = {
  maintenance: '保养',
  inspection: '年检',
  insurance: '保险',
  custom: '自定义',
}

/* ===== 车主建档：录入自己的车（静态域 + 动态域关键字段，一次入档） ===== */

const today = () => new Date().toISOString().slice(0, 10)

const FUELS = ['汽油', '柴油', '纯电', '混动']

/* ===== 车牌录入：省份简称 + 号牌，组合成「湘L·D8296」格式 ===== */

const PLATE_PROVINCES = [
  '京', '津', '沪', '渝', '冀', '豫', '云', '辽', '黑', '湘', '皖', '鲁', '新', '苏',
  '浙', '赣', '鄂', '桂', '甘', '晋', '蒙', '陕', '吉', '闽', '贵', '粤', '青', '藏',
  '川', '宁', '琼',
]

/** 清洗号牌主体：大写、去 I/O 与非法字符、最多 7 位（城市字母 + 最多 6 位序号） */
const cleanPlateRest = (v: string) =>
  v.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/[IO]/g, '').slice(0, 7)

/** 组装完整车牌：省份 + 城市字母 + · + 序号（如 湘L·D8296） */
const buildPlateNo = (prov: string, rest: string) => {
  const r = cleanPlateRest(rest)
  if (!prov || r.length < 5) return ''
  return `${prov}${r[0]}·${r.slice(1)}`
}

/** 号牌主体格式：城市字母 + 4~6 位（第 6 位序号为新能源） */
const PLATE_REST_RE = /^[A-HJ-NP-Z][A-HJ-NP-Z0-9]{4,6}$/

function AddCarCard({ onDone, collapsible }: { onDone?: () => void; collapsible?: boolean }) {
  const addCar = useApp((s) => s.addCar)
  const [open, setOpen] = useState(!collapsible)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    plateProv: '',
    plateRest: '',
    brand: '',
    model: '',
    year: String(new Date().getFullYear()),
    fuelType: '汽油',
    purchaseDate: '',
    mileage: '',
    insuranceExpiry: '',
    inspectionExpiry: '',
    lastMaintenanceMileage: '',
  })
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const plateRest = cleanPlateRest(form.plateRest)
  const plateNo = buildPlateNo(form.plateProv, form.plateRest)

  const isOtherBrand = form.brand === '其他'
  const models = getModels(form.brand)
  const years = yearOptions(form.brand, form.model)
  const yearNum = Number(form.year)

  /** 品牌级联：换品牌即清空车系与年款 */
  const pickBrand = (v: string) => {
    setForm((f) => ({ ...f, brand: v, model: '', year: String(new Date().getFullYear()) }))
  }
  /** 车系级联：带出燃料建议 + 年款落在车系上市区间内 */
  const pickModel = (v: string) => {
    setForm((f) => {
      const fuel = fuelOf(f.brand, v)
      const [start, end] = getModelYears(f.brand, v)
      const latest = Math.min(end, new Date().getFullYear())
      const cur = Number(f.year)
      return {
        ...f,
        model: v,
        year: String(cur >= start && cur <= latest ? cur : latest),
        fuelType: fuel ?? f.fuelType,
      }
    })
  }

  const num = (v: string) => Number(v.replace(/[,，\s]/g, ''))
  const valid =
    !!plateNo &&
    PLATE_REST_RE.test(plateRest) &&
    form.brand.trim() &&
    form.model.trim() &&
    form.purchaseDate &&
    form.insuranceExpiry &&
    form.inspectionExpiry &&
    form.mileage !== '' &&
    num(form.mileage) >= 0 &&
    yearNum >= 1980 &&
    yearNum <= 2100

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    const input: CarFormInput = {
      plateNo,
      brand: form.brand,
      model: form.model,
      year: yearNum,
      fuelType: form.fuelType,
      purchaseDate: form.purchaseDate,
      mileage: num(form.mileage),
      mileageAt: today(),
      insuranceExpiry: form.insuranceExpiry,
      inspectionExpiry: form.inspectionExpiry,
      lastMaintenanceMileage: form.lastMaintenanceMileage !== '' ? num(form.lastMaintenanceMileage) : undefined,
    }
    addCar(input)
    // 给后端同步留一拍（提醒 id 以服务端返回为准）
    await new Promise((r) => setTimeout(r, 600))
    setBusy(false)
    onDone?.()
  }

  if (collapsible && !open) {
    return (
      <button className="tool-chip !text-[14px] !py-1.5" onClick={() => setOpen(true)}>
        ＋ 再添加一辆车
      </button>
    )
  }

  return (
    <div className="card overflow-hidden anim-up">
      <div className="zebra-soft" />
      <div className="p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="kicker !text-hwy">NEW CAR · 车辆入档</span>
          <span className="text-faint text-[12.5px]">选品牌 → 选车系 → 选年款，识途自动建立提醒与保养周期</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-6">
          {/* 车牌：省份简称 + 号牌，蓝牌样式（新能源 6 位序号自动兼容） */}
          <div className="sm:col-span-2">
            <label className="field-label">车牌号 *</label>
            <div className="inline-flex items-stretch rounded-[10px] overflow-hidden border-[3px] border-white shadow-[0_8px_18px_-8px_rgba(15,40,80,.55)] bg-gradient-to-b from-[#2A62C4] to-[#17418F]">
              <select
                className="w-[62px] bg-transparent text-white text-[21px] font-bold text-center outline-none cursor-pointer py-2 appearance-none"
                value={form.plateProv}
                onChange={(e) => set('plateProv', e.target.value)}
              >
                <option value="" className="text-ink">省</option>
                {PLATE_PROVINCES.map((p) => (
                  <option key={p} value={p} className="text-ink">
                    {p}
                  </option>
                ))}
              </select>
              <span className="w-[2px] bg-white/70 my-1.5" />
              <input
                className="w-[190px] bg-transparent text-white text-[21px] font-num font-bold tracking-[.22em] text-center outline-none py-2 placeholder:text-white/40 placeholder:font-normal placeholder:tracking-[.12em] placeholder:text-[17px]"
                placeholder="B·D8296"
                inputMode="text"
                autoCapitalize="characters"
                value={form.plateRest}
                onChange={(e) => set('plateRest', e.target.value)}
              />
            </div>
            <span className="block text-faint text-[12px] mt-2">
              {plateNo ? `识别为 ${plateNo}` : '城市字母 + 5 位序号；新能源第 6 位序号（如 D/F 开头）自动兼容'}
            </span>
          </div>
          <div>
            <label className="field-label">品牌 *</label>
            <select className="field" value={form.brand} onChange={(e) => pickBrand(e.target.value)}>
              <option value="">选择品牌</option>
              {BRANDS.map((b) => (
                <option key={b}>{b}</option>
              ))}
              <option value="其他">其他 / 未列出</option>
            </select>
          </div>
          <div>
            <label className="field-label">车系 *</label>
            {isOtherBrand ? (
              <input
                className="field"
                placeholder="手动输入车型，如：smart 精灵#1"
                value={form.model}
                onChange={(e) => set('model', e.target.value)}
                maxLength={40}
              />
            ) : (
              <select className="field" value={form.model} onChange={(e) => pickModel(e.target.value)} disabled={!form.brand}>
                <option value="">{form.brand ? '选择车系' : '请先选择品牌'}</option>
                {models.map((m) => (
                  <option key={m.name}>{m.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">年款 *</label>
              {isOtherBrand ? (
                <input className="field font-num" type="number" min={1980} max={2100} value={form.year} onChange={(e) => set('year', e.target.value)} />
              ) : (
                <select className="field font-num" value={form.year} onChange={(e) => set('year', e.target.value)} disabled={!form.model}>
                  {!form.model && <option value={String(new Date().getFullYear())}>{new Date().getFullYear()}</option>}
                  {years.map((y) => (
                    <option key={y} value={String(y)}>
                      {y} 款
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="field-label">燃料 *</label>
              <select className="field" value={form.fuelType} onChange={(e) => set('fuelType', e.target.value)}>
                {FUELS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="field-label">购车日期 *</label>
            <input className="field" type="date" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} />
          </div>
          <div>
            <label className="field-label">当前里程（km）*</label>
            <input className="field" type="number" min={0} placeholder="如：43200" value={form.mileage} onChange={(e) => set('mileage', e.target.value)} />
          </div>
          <div>
            <label className="field-label">保险到期日 *</label>
            <input className="field" type="date" value={form.insuranceExpiry} onChange={(e) => set('insuranceExpiry', e.target.value)} />
          </div>
          <div>
            <label className="field-label">年检到期日 *</label>
            <input className="field" type="date" value={form.inspectionExpiry} onChange={(e) => set('inspectionExpiry', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label">上次保养时的里程（选填，用于计算保养周期）</label>
            <input className="field" type="number" min={0} placeholder="不填则从当前里程开始计算周期" value={form.lastMaintenanceMileage} onChange={(e) => set('lastMaintenanceMileage', e.target.value)} />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-6 flex-wrap">
          <button className="btn btn-bronze !py-2.5 !px-7" disabled={!valid || busy} onClick={() => void submit()}>
            {busy ? (
              <span className="thinking">
                <span />
                <span />
                <span />
              </span>
            ) : (
              '落档 · 开始照看'
            )}
          </button>
          {valid ? null : <span className="text-faint text-[12.5px]">带 * 为必填</span>}
          {collapsible && (
            <button className="text-faint text-[13px] hover:text-sub ml-auto" onClick={() => setOpen(false)}>
              收起
            </button>
          )}
        </div>
        <p className="text-faint text-[12px] mt-4 leading-[1.9]">
          车型库参考公开车型信息整理（演示数据集，覆盖 {CATALOG_SIZE.brands} 个品牌 · {CATALOG_SIZE.models} 个车系，含停售经典款）；正式版对接汽车之家 / 懂车帝等车型主数据服务，品牌-车系-年款实时同步。
        </p>
      </div>
    </div>
  )
}

/* ===== 空车库引导：新账号从自己录入的第一辆车开始 ===== */

function EmptyGarage() {
  const user = useApp((s) => s.user)
  const demo = user ? isDemoAccount(user.email) : false
  return (
    <div className="pb-10">
      <div className="ink-card relative overflow-hidden anim-up p-6 md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="kicker !text-mark">MY GARAGE · 我的车库</div>
            <h1 className="font-display text-[30px] md:text-[38px] text-white mt-4 leading-[1.3]">
              车库还是空的，
              <br />
              从录入你的第一辆车开始
            </h1>
            <p className="text-white/55 text-[15px] mt-4 leading-[2] max-w-[560px]">
              识途不预填任何假数据 —— 车牌、里程、保险与年检到期日由你自己录入，
              之后识途基于这份档案替你记着、盯着、办妥每一件事。
            </p>
          </div>
          <CarGlyph className="w-44 h-24 opacity-70 hidden sm:block" />
        </div>
        <div className="flex flex-wrap gap-x-7 gap-y-2.5 mt-7">
          {[
            ['一次录入', '档案三域自动建立'],
            ['到期主动', '保险/年检/保养提醒'],
            ['越用越懂', '事件履历持续沉淀'],
          ].map(([a, b]) => (
            <span key={a} className="flex items-center gap-2 text-[13.5px] text-white/65">
              <span className="w-[7px] h-[7px] rounded-[2px] bg-mark inline-block shrink-0" />
              <b className="text-white">{a}</b>
              {b}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <AddCarCard />
      </div>

      {demo && (
        <p className="text-faint text-[13px] mt-6 leading-[1.9]">
          演示说明：当前为演示账号但未载入示例档案 —— 可在「设置」页点击「重置样例数据」恢复预置档案，用于体验保养/理赔全流程。
        </p>
      )}
    </div>
  )
}

export default function Cars() {
  const cars = useApp((s) => s.cars)
  const reminders = useApp((s) => s.reminders)
  const reminderDone = useApp((s) => s.reminderDone)
  const reminderSnooze = useApp((s) => s.reminderSnooze)
  const navigate = useNavigate()
  const revealRef = useReveal()

  // 空车库（新注册账号）：进入建档引导 —— 数据由车主自己录入，识途不预填
  if (cars.length === 0) return <EmptyGarage />

  const car = cars[0]
  const pending = reminders.filter((r) => r.status === 'pending' || r.status === 'snoozed')
  const cycleUsed = car.state.mileage - (car.state.lastMaintenanceMileage ?? 0)

  // 车历长卷：走过的每一步 + 识途盯着的前路
  const journeyPast: JourneyPoint[] = [
    { date: car.static.purchaseDate.slice(2, 7), label: '购车入档' },
    ...[...car.events]
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
      .map((e) => ({ date: e.occurredAt.slice(2, 7), label: e.title })),
  ]
  const journeyFuture: JourneyPoint[] = pending
    .slice()
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .map((r) => ({ date: r.dueAt.slice(5), label: kindLabel[r.kind] ?? '待办', urgent: r.kind === 'maintenance' }))

  return (
    <div ref={revealRef} className="pb-10">
      {/* ===== Hero：沥青档案板 + LED 情报板 ===== */}
      <div className="ink-card relative overflow-hidden anim-up">
        {/* LED 可变情报板 */}
        <div className="ledboard !border-x-0 !border-t-0 px-0 py-2">
          <div className="marquee-track text-[15px]">
            {[0, 1].map((k) => (
              <span key={k} className="flex shrink-0">
                <span className="px-7">【识途情报】{car.static.plateNo} 保养周期已到</span>
                <span className="px-7">年检 {car.state.inspectionExpiry.slice(0, 7)} 到期</span>
                <span className="px-7">保险 {car.state.insuranceExpiry.slice(0, 7)} 到期</span>
                <span className="px-7">雨季将至 · 建议检查雨刮</span>
                <span className="px-7">前方服务区：保养管家 1 项待办</span>
              </span>
            ))}
          </div>
        </div>

        <div className="p-6 md:p-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="kicker !text-mark">CARPROFILE · 车辆数字档案</div>
              <div className="mt-4 flex items-center gap-4 flex-wrap">
                <h1 className="font-display text-[28px] md:text-[36px] leading-none">{car.static.plateNo}</h1>
                <span className="text-white/45 text-[14px]">{car.static.model} · {car.static.fuelType}</span>
              </div>
              <div className="text-white/55 text-[14.5px] mt-2.5">
                购车于 {car.static.purchaseDate.slice(0, 7)} · 家庭自用 · 档案更新于 {car.state.mileageAt}
              </div>
            </div>
            <CarGlyph className="w-52 h-28 opacity-80 hidden sm:block" />
          </div>

          <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center mt-7">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <DarkStat value={car.state.mileage.toLocaleString()} label="当前里程 km" delay={60} />
              <DarkStat value="11 个月" label="距上次保养" delay={140} />
              <DarkStat value={car.state.insuranceExpiry} label="保险到期" delay={220} />
              <DarkStat value={car.state.inspectionExpiry.slice(0, 7)} label="下次年检" delay={300} />
            </div>
            <div className="hidden md:flex justify-center pr-2">
              <Gauge value={cycleUsed} max={10000} label="本保养周期已行驶" unit="km" dark />
            </div>
          </div>

          <div className="flex gap-3 mt-7 flex-wrap">
            <button className="btn btn-bronze" onClick={() => navigate('/care')}>
              {Icons.care} 保养管家已发现 1 项待办
            </button>
            <Link
              to={`/cars/${car.static.id}`}
              className="btn !bg-asphalt-3 !text-[#EDEAE2] hover:!bg-[#343945] !border !border-white/15"
            >
              查看完整档案
            </Link>
          </div>

          {/* 识车之途 · 车历长卷：把档案画成一条公路 */}
          <JourneyStrip past={journeyPast} now={{ km: car.state.mileage.toLocaleString() }} future={journeyFuture} />
        </div>
      </div>

      {/* ===== 对话式入口（问识途） ===== */}
      <section className="mt-12">
        <SectionHead
          kicker="AGENT · 对话式入口"
          title="问识途：说什么都行"
          sub="基于车辆档案三域回答，LLM 只负责表达、事实全部可溯源；回答附带可一键执行的行动建议。"
        />
        <AskCard />
      </section>

      {/* ===== 提醒 ===== */}
      <section className="mt-12">
        <SectionHead
          kicker="REMINDERS · 主动提醒"
          title="识途替你盯着，到期的事一件不落"
          sub="规则引擎按手册周期 × 里程 × 时间生成提醒，不依赖大模型也能可靠工作；点击「去处理」交给保养管家一次办完。"
        />
        <div className="flex flex-col gap-3.5">
          {pending.map((r, i) => (
            <div
              key={r.id}
              className={`card card-lift reveal flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4 ${r.status === 'snoozed' ? 'opacity-70' : ''}`}
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <span className="w-10 h-10 rounded-[10px] bg-hwy-tint text-hwy-deep flex items-center justify-center shrink-0">
                {Icons.bell}
              </span>
              <div className="min-w-0">
                <div className="font-bold text-[16.5px]">
                  {r.title}
                  {r.status === 'snoozed' && <span className="badge-soft ml-2">已稍后</span>}
                </div>
                <div className="text-sub text-[14px]">
                  {kindLabel[r.kind]} · 到期 {r.dueAt}
                </div>
              </div>
              <div className="ml-auto flex gap-2.5 flex-wrap">
                {r.kind === 'maintenance' && (
                  <button className="btn btn-ink !py-2 !px-4 !text-[14px]" onClick={() => navigate('/care')}>
                    去处理
                  </button>
                )}
                <button
                  className="btn btn-ghost !py-2 !px-4 !text-[14px]"
                  onClick={() => (r.status === 'snoozed' ? reminderDone(r.id) : reminderSnooze(r.id))}
                >
                  {r.status === 'snoozed' ? '标记完成' : '稍后提醒'}
                </button>
                <button className="btn btn-ghost !py-2 !px-4 !text-[14px] !border-line !text-sub" onClick={() => reminderDone(r.id)}>
                  不需要了
                </button>
              </div>
            </div>
          ))}
          {pending.length === 0 && (
            <div className="card flex items-center gap-4 px-5 py-4">
              <span className="w-10 h-10 rounded-[10px] bg-hwy-tint text-hwy flex items-center justify-center font-bold">✓</span>
              <span className="text-[15.5px] text-sub">太好了，当前没有待办提醒。</span>
            </div>
          )}
        </div>
      </section>

      {/* ===== 三域简介 ===== */}
      <section className="mt-12">
        <SectionHead kicker="THREE DOMAINS · 档案三域" title="所有建议，都从这份档案出发" />
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { t: '静态域', e: 'STATIC', d: '车型年款、配置参数、购车与上牌信息、保险与年检周期基准 —— 一次录入，长期有效。' },
            { t: '动态域', e: 'DYNAMIC', d: '里程与能耗、保养历史、保险/年检到期日 —— 手动录入或单据识别更新，是主动提醒的数据源。' },
            { t: '事件域', e: 'EVENTS', d: '维修与事故记录、理赔经历、配件更换履历 —— 换车估值时，这份履历就是车况的最好证明。' },
          ].map((d, i) => (
            <Link
              to={`/cars/${car.static.id}`}
              key={d.t}
              className="card card-lift reveal p-6 block"
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center gap-3">
                <h4 className="font-display text-[18px]">{d.t}</h4>
                <em className="not-italic badge-soft !text-[12px]">{d.e}</em>
              </div>
              <p className="text-sub text-[14.5px] mt-3 leading-[1.9]">{d.d}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
