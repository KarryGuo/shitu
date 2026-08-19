import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, type AdminOverview, type AdminUser, type AdminCar, type AdminRunSummary, type AuditFeed } from '../api/client'
import { AuthShell } from '../components/AuthShell'

/**
 * 管理后台（独立于车主端 AppShell）：
 * 口令登录 → 运营看板 / 用户管理 / 车辆管理 / 运行审计 四面板。
 * 所有管理写操作在后端入审计（actor=admin），与车主侧同一本账。
 */

type Tab = 'overview' | 'users' | 'cars' | 'audit'

/* ================= 登录门 ================= */

function LoginGate({ onOk }: { onOk: () => void }) {
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!token.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await adminApi.login(token.trim())
      onOk()
    } catch {
      setError('口令无效，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      signLabel="管理口令"
      signEn="ADMIN ACCESS"
      title="识途运营中枢"
      desc="输入管理口令进入；所有管理操作将记入审计日志，与车主侧同一本账。"
      brand={{
        kicker: 'ADMIN CONSOLE · 运营中枢',
        title: (
          <>
            中控台上看得见每一辆车，
            <br />
            也看得见<span className="text-mark">识途自己</span>
          </>
        ),
        desc: '运营看板实时呈现任务运行、LLM 与工具调用态势；用户与车辆管理跨账号触达每一份数据 —— 演示环境的每一项管理动作，都留痕可溯。',
        signs: [
          { text: '看板', sub: '运行态势一目了然' },
          { text: '用户', sub: '账号 · 权限 · 状态' },
          { text: '车辆', sub: '跨用户车辆视图' },
        ],
      }}
      footer={
        <div className="border-t border-dashed border-line pt-3 text-center">
          <span className="text-[13.5px] text-sub">管理口令由环境变量 ADMIN_TOKEN 配置</span>
          <div className="text-[12px] text-faint mt-1.5 leading-[1.8]">
            <Link to="/login" className="text-hwy-deep font-bold hover:underline">
              前往车主端登录 →
            </Link>
          </div>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div>
          <label className="field-label">管理口令</label>
          <input
            className="field font-num tracking-[.08em]"
            type="password"
            placeholder="••••••••"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoFocus
          />
        </div>
        {error && (
          <div className="rounded-[10px] border border-[#B4552D]/40 bg-[#F9E9E2] px-3.5 py-2.5 text-[13px] text-[#A0522D] font-bold">
            {error}
          </div>
        )}
        <button className="btn btn-ink w-full !py-3" type="submit" disabled={!token.trim() || busy}>
          {busy ? (
            <span className="thinking">
              <span />
              <span />
              <span />
            </span>
          ) : (
            '进入管理后台'
          )}
        </button>
      </form>
    </AuthShell>
  )
}

/* ================= 运营看板 ================= */

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-[12px] border border-line px-5 py-4">
      <div className="text-faint text-[12.5px] tracking-[.04em]">{label}</div>
      <div className="font-num font-bold text-[26px] mt-1 leading-none">{value}</div>
      {sub && <div className="text-sub text-[12.5px] mt-1.5">{sub}</div>}
    </div>
  )
}

/* ---- 可视化：环形图 / 分段条（纯 SVG + CSS，无三方依赖） ---- */

const SCENARIO_META: Record<string, { label: string; color: string }> = {
  care: { label: '保养任务', color: 'var(--hwy)' },
  claim: { label: '理赔任务', color: 'var(--mark)' },
}
const STATUS_META: Record<string, { label: string; color: string }> = {
  done: { label: '已完成', color: '#3F6B3A' },
  cancelled: { label: '已取消', color: '#B4552D' },
  running: { label: '进行中', color: 'var(--mark)' },
  awaiting_choice: { label: '待确认', color: '#6B5B33' },
}

function Donut({
  segments,
  total,
}: {
  segments: { label: string; value: number; color: string }[]
  total: number
}) {
  const R = 52
  const C = 2 * Math.PI * R
  let acc = 0
  return (
    <div className="relative w-[136px] h-[136px] shrink-0">
      <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--concrete-2)" strokeWidth="16" />
        {segments.map((s) => {
          const dash = total > 0 ? (s.value / total) * C : 0
          const el = (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="16"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={-acc}
            />
          )
          acc += dash
          return el
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-num font-bold text-[26px] leading-none">{total}</div>
        <div className="text-faint text-[11px] mt-1">总任务</div>
      </div>
    </div>
  )
}

function StackedBar({ items }: { items: { label: string; value: number; color: string }[] }) {
  const total = items.reduce((a, b) => a + b.value, 0)
  return (
    <div>
      <div className="flex h-[14px] rounded-full overflow-hidden bg-concrete-2">
        {items
          .filter((i) => i.value > 0)
          .map((i) => (
            <div
              key={i.label}
              style={{ width: `${(i.value / Math.max(1, total)) * 100}%`, background: i.color }}
              title={`${i.label} ${i.value}`}
            />
          ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5 text-[12px] text-sub">
        {items.map((i) => (
          <span key={i.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: i.color }} />
            {i.label} <b className="font-num">{i.value}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

function OverviewPanel() {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => adminApi.overview().then(setData).catch((e: Error) => setError(e.message))

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 15000)
    return () => clearInterval(t)
  }, [])

  if (error) return <div className="card p-6 text-[#A0522D] font-bold">加载失败：{error}</div>
  if (!data) return <div className="card p-6 text-sub">看板加载中…</div>

  const maxRuns = Math.max(1, ...data.trend.map((d) => d.runs))
  const scenarioSegments = Object.entries(data.runs.byScenario).map(([k, v]) => ({
    label: SCENARIO_META[k]?.label ?? k,
    value: v,
    color: SCENARIO_META[k]?.color ?? 'var(--asphalt-3)',
  }))
  const statusItems = Object.entries(data.runs.byStatus).map(([k, v]) => ({
    label: STATUS_META[k]?.label ?? k,
    value: v,
    color: STATUS_META[k]?.color ?? 'var(--faint)',
  }))
  const maxToolCalls = Math.max(1, ...data.tools.map((t) => t.calls))

  return (
    <div className="flex flex-col gap-5">
      {/* 指标卡 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <StatCard label="用户总数" value={String(data.users.total)} sub={`活跃 ${data.users.active} · 禁用 ${data.users.disabled}`} />
        <StatCard label="车辆档案" value={String(data.cars.total)} sub={`事件 ${data.cars.events} · 预约 ${data.cars.bookings}`} />
        <StatCard label="任务运行" value={String(data.runs.total)} sub={`care ${data.runs.byScenario.care ?? 0} · claim ${data.runs.byScenario.claim ?? 0}`} />
        <StatCard
          label="闭环成功率"
          value={data.runs.successRate === null ? '—' : `${data.runs.successRate}%`}
          sub={`完成 ${data.runs.byStatus.done ?? 0} · 取消 ${data.runs.byStatus.cancelled ?? 0}`}
        />
        <StatCard label="降级运行" value={String(data.runs.degradedRuns)} sub="链路未中断" />
        <StatCard
          label="LLM 调用"
          value={String(data.llm.total)}
          sub={data.llm.keyConfigured ? `${data.llm.provider} · 降级 ${data.llm.degraded}` : '未配置 Key（规则链路）'}
        />
      </div>

      {/* 近 7 日趋势 */}
      <div className="card p-6">
        <div className="kicker !text-hwy">TREND · 近 7 日任务运行</div>
        <div className="flex items-end gap-2.5 mt-5 h-[120px]">
          {data.trend.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 group">
              <div className="text-[11px] font-num text-faint opacity-0 group-hover:opacity-100 transition-opacity">{d.runs}</div>
              <div
                className="w-full rounded-t-[4px] bg-hwy/85 hover:bg-hwy transition-colors relative"
                style={{ height: `${Math.max(4, (d.runs / maxRuns) * 88)}px` }}
              >
                {d.degraded > 0 && <div className="absolute inset-x-0 top-0 h-[3px] bg-mark rounded-t-[4px]" />}
              </div>
              <div className="text-[10.5px] font-num text-faint">{d.date.slice(5)}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-5 mt-4 text-[12px] text-sub">
          <span className="flex items-center gap-1.5"><span className="w-3 h-[3px] bg-hwy rounded" />运行数</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-[3px] bg-mark rounded" />含降级</span>
          <span className="text-faint ml-auto">审计条目 {data.auditTotal} · 更新于 {data.at.slice(11, 19)}</span>
        </div>
      </div>

      {/* 任务构成 & 工具调用 */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* 任务构成环形图 + 状态分布 */}
        <div className="card p-6">
          <div className="kicker !text-hwy">MIX · 任务构成</div>
          {data.runs.total === 0 ? (
            <p className="text-sub text-[13.5px] mt-4 leading-[1.9]">
              暂无任务记录——在车主端发起一次保养或理赔任务后，这里会展示场景与状态分布。
            </p>
          ) : (
            <>
              <div className="flex items-center gap-7 mt-5">
                <Donut segments={scenarioSegments} total={data.runs.total} />
                <div className="flex flex-col gap-3 min-w-0">
                  {scenarioSegments.map((s) => (
                    <div key={s.label} className="flex items-center gap-2.5 text-[13.5px]">
                      <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: s.color }} />
                      <span className="text-sub">{s.label}</span>
                      <b className="font-num text-[15px]">{s.value}</b>
                      <span className="text-faint text-[12px] font-num ml-auto">
                        {Math.round((s.value / data.runs.total) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 pt-5 border-t border-line">
                <div className="text-faint text-[12.5px] mb-3">状态分布</div>
                <StackedBar items={statusItems} />
              </div>
            </>
          )}
        </div>

        {/* 工具调用 Top 榜 */}
        <div className="card p-6">
          <div className="kicker !text-hwy">TOOLS · 工具调用 Top</div>
          {data.tools.length === 0 ? (
            <p className="text-sub text-[13.5px] mt-4 leading-[1.9]">
              暂无工具调用记录——任务执行过程中的手册检索、门店搜索等工具会自动计入。
            </p>
          ) : (
            <div className="flex flex-col gap-3.5 mt-5">
              {data.tools.map((t) => (
                <div key={t.name} className="flex items-center gap-3">
                  <span className="w-[158px] shrink-0 truncate text-[13px] font-semibold" title={t.name}>
                    {t.name}
                  </span>
                  <div className="flex-1 h-[16px] rounded-[4px] bg-concrete-2 overflow-hidden">
                    <div
                      className="h-full rounded-[4px] transition-all"
                      style={{
                        width: `${Math.max(3, (t.calls / maxToolCalls) * 100)}%`,
                        background: t.failed > 0 ? '#B4552D' : t.degraded > 0 ? 'var(--mark)' : 'var(--hwy)',
                        opacity: t.failed > 0 || t.degraded > 0 ? 0.9 : 0.85,
                      }}
                    />
                  </div>
                  <span className="font-num text-[13px] font-bold w-[36px] text-right">{t.calls}</span>
                  <span className="w-[72px] text-right text-[11.5px] whitespace-nowrap">
                    {t.failed > 0 ? (
                      <span className="text-[#B4552D] font-bold">失败 {t.failed}</span>
                    ) : t.degraded > 0 ? (
                      <span className="text-[#8C6A1E] font-bold">降级 {t.degraded}</span>
                    ) : (
                      <span className="text-faint">正常</span>
                    )}
                  </span>
                </div>
              ))}
              <div className="text-[11.5px] text-faint mt-1">按调用量取前 6 · 条长 = 调用次数 · 颜色 = 健康度</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ================= 用户管理 ================= */

function UsersPanel() {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ email: '', name: '', role: 'user' as 'user' | 'admin' })
  const [busy, setBusy] = useState(false)

  const load = () => adminApi.listUsers().then((r) => setUsers(r.users)).catch((e: Error) => setError(e.message))
  useEffect(() => {
    void load()
  }, [])

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      await adminApi.createUser(form)
      setForm({ email: '', name: '', role: 'user' })
      setShowCreate(false)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const patch = async (id: string, body: Parameters<typeof adminApi.updateUser>[1]) => {
    setError(null)
    try {
      await adminApi.updateUser(id, body)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const remove = async (u: AdminUser) => {
    if (!confirm(`确认删除用户 ${u.email}？`)) return
    setError(null)
    try {
      await adminApi.deleteUser(u.id)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!users) return <div className="card p-6 text-sub">用户列表加载中…</div>

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-line">
        <span className="kicker !text-hwy !mb-0">USERS · 用户管理</span>
        <span className="text-faint text-[12.5px]">{users.length} 个账户</span>
        <button className="btn btn-bronze !py-1.5 !px-4 !text-[13px] ml-auto" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? '收起' : '+ 创建用户'}
        </button>
      </div>

      {error && <div className="px-5 py-2.5 text-[13px] text-[#A0522D] font-bold bg-[#F9E9E2]">{error}</div>}

      {showCreate && (
        <form
          className="flex flex-wrap gap-2.5 px-5 py-4 border-b border-line bg-paper"
          onSubmit={(e) => {
            e.preventDefault()
            void create()
          }}
        >
          <input className="field !w-[220px]" placeholder="手机号或邮箱" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className="field !w-[160px]" placeholder="姓名" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={40} />
          <select className="field !w-[120px]" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'user' | 'admin' })}>
            <option value="user">车主</option>
            <option value="admin">管理员</option>
          </select>
          <button className="btn btn-ink !py-2 !px-5 !text-[13.5px]" disabled={busy || !form.email || !form.name}>
            创建
          </button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-left text-faint text-[12px] border-b border-line">
              <th className="px-5 py-2.5 font-semibold">账号</th>
              <th className="px-3 py-2.5 font-semibold">姓名</th>
              <th className="px-3 py-2.5 font-semibold">角色</th>
              <th className="px-3 py-2.5 font-semibold">状态</th>
              <th className="px-3 py-2.5 font-semibold">车辆</th>
              <th className="px-3 py-2.5 font-semibold">注册时间</th>
              <th className="px-5 py-2.5 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line/60 hover:bg-white/60">
                <td className="px-5 py-2.5 font-semibold">{u.email}</td>
                <td className="px-3 py-2.5">{u.name}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[11.5px] font-bold rounded-md px-2 py-0.5 ${u.role === 'admin' ? 'bg-[#EAE6DA] text-[#6B5B33]' : 'bg-hwy-tint text-hwy-deep'}`}>
                    {u.role === 'admin' ? '管理员' : '车主'}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`text-[11.5px] font-bold rounded-md px-2 py-0.5 ${u.status === 'active' ? 'bg-[#E4EEE2] text-[#3F6B3A]' : 'bg-[#F9E9E2] text-[#B4552D]'}`}>
                    {u.status === 'active' ? '活跃' : '已禁用'}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-num">{u.cars}</td>
                <td className="px-3 py-2.5 font-num text-faint">{u.created_at.slice(0, 10)}</td>
                <td className="px-5 py-2.5 text-right whitespace-nowrap">
                  <button className="text-[12.5px] font-bold text-hwy hover:underline mr-3" onClick={() => void patch(u.id, { status: u.status === 'active' ? 'disabled' : 'active' })}>
                    {u.status === 'active' ? '禁用' : '启用'}
                  </button>
                  <button className="text-[12.5px] font-bold text-sub hover:underline mr-3" onClick={() => void patch(u.id, { role: u.role === 'admin' ? 'user' : 'admin' })}>
                    {u.role === 'admin' ? '降为车主' : '设为管理员'}
                  </button>
                  <button className="text-[12.5px] font-bold text-[#A0522D] hover:underline" onClick={() => void remove(u)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ================= 车辆管理 ================= */

function CarsPanel() {
  const [cars, setCars] = useState<AdminCar[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminCar | null>(null)
  const [form, setForm] = useState({ mileage: '', insuranceExpiry: '', inspectionExpiry: '' })
  const [busy, setBusy] = useState(false)

  const load = () => adminApi.listCars().then((r) => setCars(r.cars)).catch((e: Error) => setError(e.message))
  useEffect(() => {
    void load()
  }, [])

  const openEdit = (c: AdminCar) => {
    setEditing(c)
    setForm({ mileage: String(c.mileage), insuranceExpiry: c.insuranceExpiry, inspectionExpiry: c.inspectionExpiry })
  }

  const save = async () => {
    if (!editing || busy) return
    setBusy(true)
    setError(null)
    try {
      await adminApi.updateCar(editing.id, {
        mileage: Number(form.mileage) || 0,
        insuranceExpiry: form.insuranceExpiry,
        inspectionExpiry: form.inspectionExpiry,
      })
      setEditing(null)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (c: AdminCar) => {
    if (!confirm(`确认删除车辆 ${c.plateNo}？将级联清理其提醒与预约。`)) return
    setError(null)
    try {
      await adminApi.deleteCar(c.id)
      await load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!cars) return <div className="card p-6 text-sub">车辆列表加载中…</div>

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-line">
        <span className="kicker !text-hwy !mb-0">CARS · 车辆管理</span>
        <span className="text-faint text-[12.5px]">{cars.length} 辆在档</span>
        <span className="text-faint text-[12px] ml-auto">编辑走 store 写透：内存态与数据库同步</span>
      </div>

      {error && <div className="px-5 py-2.5 text-[13px] text-[#A0522D] font-bold bg-[#F9E9E2]">{error}</div>}

      {editing && (
        <form
          className="flex flex-wrap items-end gap-2.5 px-5 py-4 border-b border-line bg-paper"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <div>
            <label className="field-label">车牌</label>
            <div className="font-bold text-[14px] py-2">{editing.plateNo}</div>
          </div>
          <div>
            <label className="field-label">里程（km）</label>
            <input className="field !w-[130px] font-num" type="number" min={0} value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} />
          </div>
          <div>
            <label className="field-label">保险到期</label>
            <input className="field !w-[150px] font-num" type="date" value={form.insuranceExpiry} onChange={(e) => setForm({ ...form, insuranceExpiry: e.target.value })} />
          </div>
          <div>
            <label className="field-label">年检到期</label>
            <input className="field !w-[150px] font-num" type="date" value={form.inspectionExpiry} onChange={(e) => setForm({ ...form, inspectionExpiry: e.target.value })} />
          </div>
          <button className="btn btn-ink !py-2 !px-5 !text-[13.5px]" disabled={busy}>保存</button>
          <button type="button" className="btn btn-ghost !py-2 !px-4 !text-[13.5px]" onClick={() => setEditing(null)}>取消</button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-left text-faint text-[12px] border-b border-line">
              <th className="px-5 py-2.5 font-semibold">车牌</th>
              <th className="px-3 py-2.5 font-semibold">车型</th>
              <th className="px-3 py-2.5 font-semibold">车主</th>
              <th className="px-3 py-2.5 font-semibold">里程</th>
              <th className="px-3 py-2.5 font-semibold">保险到期</th>
              <th className="px-3 py-2.5 font-semibold">年检到期</th>
              <th className="px-3 py-2.5 font-semibold">档案事件</th>
              <th className="px-5 py-2.5 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {cars.map((c) => (
              <tr key={c.id} className="border-b border-line/60 hover:bg-white/60">
                <td className="px-5 py-2.5 font-bold">{c.plateNo}</td>
                <td className="px-3 py-2.5">{c.brand} {c.model}（{c.year}）</td>
                <td className="px-3 py-2.5">{c.owner}</td>
                <td className="px-3 py-2.5 font-num">{c.mileage.toLocaleString()} km</td>
                <td className="px-3 py-2.5 font-num">{c.insuranceExpiry}</td>
                <td className="px-3 py-2.5 font-num">{c.inspectionExpiry}</td>
                <td className="px-3 py-2.5 font-num">{c.events}</td>
                <td className="px-5 py-2.5 text-right whitespace-nowrap">
                  <button className="text-[12.5px] font-bold text-hwy hover:underline mr-3" onClick={() => openEdit(c)}>编辑</button>
                  <button className="text-[12.5px] font-bold text-[#A0522D] hover:underline" onClick={() => void remove(c)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ================= 运行审计（全量查阅） ================= */

/** 简易分页钩子：数据变化时自动收敛当前页 */
function usePaged<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paged = items.slice((safePage - 1) * pageSize, safePage * pageSize)
  return { page: safePage, totalPages, paged, setPage, total: items.length }
}

function Pager({ page, totalPages, total, onPage }: { page: number; totalPages: number; total: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 pt-3.5 pb-1">
      <button className="btn btn-ghost !py-1.5 !px-3.5 !text-[13px]" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        上一页
      </button>
      <span className="text-faint text-[13px] num">
        {page} / {totalPages} 页 · 共 {total} 条
      </span>
      <button className="btn btn-ghost !py-1.5 !px-3.5 !text-[13px]" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        下一页
      </button>
    </div>
  )
}

/** 导出 Excel（CSV · UTF-8 BOM） */
function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

const RUN_STATUS: Record<string, { label: string; cls: string }> = {
  done: { label: '已完成', cls: 'bg-[#E4EEE2] text-[#3F6B3A]' },
  waiting: { label: '待确认', cls: 'bg-[#F7EED8] text-[#8C6A1E]' },
  running: { label: '执行中', cls: 'bg-[#E8EEF4] text-[#3A6B8C]' },
  failed: { label: '已失败', cls: 'bg-[#F9E9E2] text-[#B4552D]' },
  cancelled: { label: '已取消', cls: 'bg-concrete-2 text-sub' },
  interrupted: { label: '已中断', cls: 'bg-concrete-2 text-sub' },
}

const AUDIT_ACTOR: Record<string, { label: string; cls: string }> = {
  agent: { label: 'Agent', cls: 'bg-hwy-tint text-hwy-deep' },
  user: { label: '车主', cls: 'bg-[#E8EEF4] text-[#3A6B8C]' },
  system: { label: '系统', cls: 'bg-concrete-2 text-sub' },
  admin: { label: '管理员', cls: 'bg-[#EAE6DA] text-[#6B5B33]' },
}

const SCENARIO_LABEL: Record<string, string> = { care: '保养', claim: '理赔', trip: '行程', trade: '换车' }

const fmtTime = (iso: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function AdminAuditPanel() {
  const [runs, setRuns] = useState<AdminRunSummary[]>([])
  const [audit, setAudit] = useState<AuditFeed['entries']>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void Promise.all([adminApi.listRuns(), adminApi.listAudit()])
      .then(([r, a]) => {
        setRuns(r.runs)
        setAudit(a.entries)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const runPages = usePaged(runs, 10)
  const auditPages = usePaged(audit, 10)

  if (error) return <div className="card p-6 text-[#A0522D] font-bold">加载失败：{error}</div>
  if (loading) return <div className="card p-6 text-sub">运行审计加载中…</div>

  return (
    <div className="flex flex-col gap-5">
      {/* 运行列表（全量） */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line">
          <span className="kicker !text-hwy !mb-0">RUNS · 运行列表（全量）</span>
          <span className="text-faint text-[12.5px]">{runs.length} 条记录</span>
          <button
            className="btn btn-ghost !py-1.5 !px-3.5 !text-[12.5px] ml-auto"
            onClick={() =>
              exportCsv(
                `运行列表_全量_${new Date().toISOString().slice(0, 10)}.csv`,
                ['运行ID', '状态', '场景', '异常注入', '步数', '降级次数', '发起时间', '结束时间'],
                runs.map((r) => [
                  r.id, RUN_STATUS[r.status]?.label ?? r.status, SCENARIO_LABEL[r.scenario] ?? r.scenario,
                  r.inject === 'none' ? '' : r.inject, r.steps, r.degradations, fmtTime(r.createdAt), fmtTime(r.finishedAt),
                ]),
              )
            }
          >
            导出 Excel
          </button>
        </div>
        <div className="overflow-x-auto">
          {runs.length === 0 ? (
            <p className="text-sub text-[13.5px] px-5 py-6 text-center">暂无运行记录。</p>
          ) : (
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="text-left text-faint text-[12px] border-b border-line">
                  <th className="px-5 py-2.5 font-semibold">运行 ID</th>
                  <th className="px-3 py-2.5 font-semibold">状态</th>
                  <th className="px-3 py-2.5 font-semibold">场景</th>
                  <th className="px-3 py-2.5 font-semibold">异常注入</th>
                  <th className="px-3 py-2.5 font-semibold">步数</th>
                  <th className="px-3 py-2.5 font-semibold">降级</th>
                  <th className="px-3 py-2.5 font-semibold">发起时间</th>
                  <th className="px-5 py-2.5 font-semibold">结束时间</th>
                </tr>
              </thead>
              <tbody>
                {runPages.paged.map((r) => {
                  const m = RUN_STATUS[r.status] ?? RUN_STATUS.running
                  return (
                    <tr key={r.id} className="border-b border-line/60 hover:bg-white/60">
                      <td className="px-5 py-2.5 font-num text-faint text-[12.5px]">{r.id}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[11.5px] font-bold rounded-md px-2 py-0.5 ${m.cls}`}>{m.label}</span>
                      </td>
                      <td className="px-3 py-2.5">{SCENARIO_LABEL[r.scenario] ?? r.scenario}</td>
                      <td className="px-3 py-2.5">
                        {r.inject !== 'none' ? (
                          <span className="text-[11.5px] font-bold rounded-md px-2 py-0.5 bg-[#F9E9E2] text-[#B4552D]">{r.inject}</span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-num">{r.steps}</td>
                      <td className="px-3 py-2.5 font-num">{r.degradations > 0 ? <span className="text-[#8C6A1E] font-bold">⚠ {r.degradations}</span> : '—'}</td>
                      <td className="px-3 py-2.5 font-num text-faint text-[12.5px] whitespace-nowrap">{fmtTime(r.createdAt)}</td>
                      <td className="px-5 py-2.5 font-num text-faint text-[12.5px] whitespace-nowrap">{fmtTime(r.finishedAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-5 pb-4">
          <Pager page={runPages.page} totalPages={runPages.totalPages} total={runPages.total} onPage={runPages.setPage} />
        </div>
      </div>

      {/* 审计日志（全量） */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line">
          <span className="kicker !text-hwy !mb-0">AUDIT · 审计日志（全量）</span>
          <span className="text-faint text-[12.5px]">{audit.length} 条记录</span>
          <button
            className="btn btn-ghost !py-1.5 !px-3.5 !text-[12.5px] ml-auto"
            onClick={() =>
              exportCsv(
                `审计日志_全量_${new Date().toISOString().slice(0, 10)}.csv`,
                ['时间', '角色', '动作', '详情', '运行ID'],
                audit.map((e) => [fmtTime(e.at), AUDIT_ACTOR[e.actor]?.label ?? e.actor, e.action, e.detail ?? '', e.runId ?? '']),
              )
            }
          >
            导出 Excel
          </button>
        </div>
        <div className="overflow-x-auto">
          {audit.length === 0 ? (
            <p className="text-sub text-[13.5px] px-5 py-6 text-center">暂无审计记录。</p>
          ) : (
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="text-left text-faint text-[12px] border-b border-line">
                  <th className="px-5 py-2.5 font-semibold">时间</th>
                  <th className="px-3 py-2.5 font-semibold">角色</th>
                  <th className="px-3 py-2.5 font-semibold">动作</th>
                  <th className="px-3 py-2.5 font-semibold">详情</th>
                  <th className="px-5 py-2.5 font-semibold">运行 ID</th>
                </tr>
              </thead>
              <tbody>
                {auditPages.paged.map((e, i) => {
                  const m = AUDIT_ACTOR[e.actor] ?? AUDIT_ACTOR.system
                  return (
                    <tr key={`${e.at}-${(auditPages.page - 1) * 10 + i}`} className="border-b border-line/60 hover:bg-white/60">
                      <td className="px-5 py-2.5 font-num text-faint text-[12.5px] whitespace-nowrap">{fmtTime(e.at)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[11.5px] font-bold rounded-md px-2 py-0.5 ${m.cls}`}>{m.label}</span>
                      </td>
                      <td className="px-3 py-2.5 font-num font-semibold text-[13px] whitespace-nowrap">{e.action}</td>
                      <td className="px-3 py-2.5 text-sub text-[13px] max-w-[380px] truncate" title={e.detail}>{e.detail ?? '—'}</td>
                      <td className="px-5 py-2.5 font-num text-faint text-[12px]">{e.runId ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-5 pb-4">
          <Pager page={auditPages.page} totalPages={auditPages.totalPages} total={auditPages.total} onPage={auditPages.setPage} />
        </div>
      </div>

      <p className="text-faint text-[12.5px] leading-[1.9] px-1">
        车主侧「审计」页仅展示各表最新 100 条；此处直查数据库全量留痕，可翻阅更早的历史记录，支持导出 Excel。
      </p>
    </div>
  )
}

/* ================= 主入口 ================= */

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: '运营看板' },
  { key: 'users', label: '用户管理' },
  { key: 'cars', label: '车辆管理' },
  { key: 'audit', label: '运行审计' },
]

export default function Admin() {
  const [authed, setAuthed] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [checked, setChecked] = useState(false)

  // 已有口令则静默进入（首个请求 401 时会踢回登录门）
  useEffect(() => {
    if (adminApi.hasToken()) setAuthed(true)
    setChecked(true)
  }, [])

  if (!checked) return null
  if (!authed) return <LoginGate onOk={() => setAuthed(true)} />

  return (
    <div className="min-h-screen bg-paper">
      {/* 顶栏 */}
      <header className="bg-asphalt text-white sticky top-0 z-40">
        <div className="max-w-[1200px] mx-auto px-5 h-[68px] flex items-center gap-4">
          <span className="sign sign-sm px-4 py-2 font-sign text-[17px] tracking-[.12em] leading-none flex items-center shrink-0">识途管理后台</span>
          <span className="ledboard !rounded-[6px] px-2.5 py-[3px] text-[11.5px] hidden sm:inline-block">ADMIN CONSOLE</span>
          <nav className="flex gap-1.5 ml-4 md:ml-6 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3.5 py-2 rounded-[8px] text-[14px] font-semibold transition-colors whitespace-nowrap ${
                  tab === t.key ? 'bg-mark text-asphalt font-bold' : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4 shrink-0">
            <Link to="/login" className="text-[13px] text-white/70 hover:text-white">车主端 →</Link>
            <button
              className="text-[13px] text-white/70 hover:text-white"
              onClick={() => {
                adminApi.logout()
                setAuthed(false)
              }}
            >
              退出
            </button>
          </div>
        </div>
      </header>

      {/* 面板 */}
      <main className="max-w-[1200px] mx-auto px-5 py-7">
        {tab === 'overview' && <OverviewPanel />}
        {tab === 'users' && <UsersPanel />}
        {tab === 'cars' && <CarsPanel />}
        {tab === 'audit' && <AdminAuditPanel />}
      </main>

      <footer className="max-w-[1200px] mx-auto px-5 pb-8 text-faint text-[12px]">
        管理操作全程入审计（actor=admin）· 与车主侧同一本账
      </footer>
    </div>
  )
}
