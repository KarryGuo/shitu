import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../stores/app'
import { useReveal } from '../hooks/useReveal'
import { SectionHead, DarkStat } from '../components/ui'
import { Gauge, CarGlyph, JourneyStrip, type JourneyPoint } from '../components/art'
import { Icons } from '../components/AppShell'
import { api, type AskResult } from '../api/client'

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

export default function Cars() {
  const cars = useApp((s) => s.cars)
  const reminders = useApp((s) => s.reminders)
  const reminderDone = useApp((s) => s.reminderDone)
  const reminderSnooze = useApp((s) => s.reminderSnooze)
  const navigate = useNavigate()
  const revealRef = useReveal()

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
