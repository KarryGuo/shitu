import { create } from 'zustand'
import type { Car, Reminder, Booking, UserPrefs, CarEvent } from '@shitu/shared'
import { seedCars, seedReminders, seedBookings, defaultPrefs } from '../api/mock'
import { api } from '../api/client'

interface User {
  email: string
  nickname: string
}

/** 演示账号：评委/演示用，登录即载入预置样例档案；其他账号一律从空车库开始自建档案 */
export const DEMO_ACCOUNT = 'admin@shitu.app'
export const isDemoAccount = (email: string) => email.trim().toLowerCase() === DEMO_ACCOUNT

/** 新车建档表单输入 */
export interface CarFormInput {
  plateNo: string
  brand: string
  model: string
  year: number
  fuelType: string
  purchaseDate: string
  mileage: number
  mileageAt: string
  insuranceExpiry: string
  inspectionExpiry: string
  lastMaintenanceMileage?: number
}

interface AppState {
  user: User | null
  cars: Car[]
  reminders: Reminder[]
  bookings: Booking[]
  prefs: UserPrefs
  login: (email: string, nickname?: string) => void
  logout: () => void
  deleteAccount: () => void
  setPrefs: (p: Partial<UserPrefs>) => void
  /** 车主建档：本地入库 + 生成基础提醒 + 同步后端主车（失败静默，本地档案不受影响） */
  addCar: (input: CarFormInput) => Car
  addBooking: (b: Omit<Booking, 'id'>) => string
  setBookingStatus: (id: string, status: Booking['status']) => void
  addEvent: (carId: string, e: Omit<CarEvent, 'id' | 'carId'>) => void
  reminderDone: (id: string) => void
  reminderSnooze: (id: string) => void
  /** 任务闭环完成后回写：按主车 carId 合并（保留本地其他车辆与提醒） */
  hydrate: (p: { cars: Car[]; reminders: Reminder[]; bookings: Booking[] }) => void
  resetDemo: () => void
}

let seq = 100
/** 带时间片前缀：刷新后 seq 归零也不会与已持久化数据撞号 */
const uid = (p: string) => `${p}${Date.now().toString(36)}${(++seq).toString(36)}`

/** 登录态轻持久化：刷新不丢（真实实现为 JWT refresh 轮换） */
const loadUser = (): User | null => {
  try {
    const raw = localStorage.getItem('shitu_user')
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}
const saveUser = (u: User | null) => {
  try {
    if (u) localStorage.setItem('shitu_user', JSON.stringify(u))
    else localStorage.removeItem('shitu_user')
  } catch {
    /* ignore */
  }
}

/* ---------- 车辆档案按账号隔离持久化（真实实现为按 user_id 入库 Turso） ---------- */
interface Persisted {
  cars: Car[]
  reminders: Reminder[]
  bookings: Booking[]
  prefs: UserPrefs
}
const dataKey = (email: string) => `shitu_data_${email.trim().toLowerCase()}`

const loadAccountData = (email: string): Persisted => {
  try {
    const raw = localStorage.getItem(dataKey(email))
    if (raw) return JSON.parse(raw) as Persisted
  } catch {
    /* ignore */
  }
  // 无已存数据：演示账号载入样例档案；其他账号从空车库开始
  if (isDemoAccount(email)) {
    return { cars: seedCars, reminders: seedReminders, bookings: seedBookings, prefs: defaultPrefs }
  }
  return { cars: [], reminders: [], bookings: [], prefs: defaultPrefs }
}

const saveAccountData = (email: string, p: Persisted) => {
  try {
    localStorage.setItem(dataKey(email), JSON.stringify(p))
  } catch {
    /* ignore */
  }
}
const clearAccountData = (email: string) => {
  try {
    localStorage.removeItem(dataKey(email))
  } catch {
    /* ignore */
  }
}

/** 新车建档：本地生成基础提醒（保险/年检/保养），与后端 setActiveCar 同源逻辑 */
function buildReminders(car: Car): Reminder[] {
  const cycleUsed = car.state.mileage - (car.state.lastMaintenanceMileage ?? car.state.mileage)
  const careDue = cycleUsed >= 7000 ? car.state.mileageAt : addMonths(car.state.mileageAt, 12)
  return [
    { id: uid('r'), carId: car.static.id, kind: 'insurance', title: '保险到期', dueAt: car.state.insuranceExpiry, status: 'pending' },
    { id: uid('r'), carId: car.static.id, kind: 'inspection', title: '年检到期', dueAt: car.state.inspectionExpiry, status: 'pending' },
    {
      id: uid('r'), carId: car.static.id, kind: 'maintenance',
      title: cycleUsed >= 7000 ? `常规保养 · 手册周期${cycleUsed >= 10000 ? '已到' : '临近'}` : '常规保养 · 满 12 个月',
      dueAt: careDue, status: 'pending',
    },
  ]
}

function addMonths(dateIso: string, months: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

export const useApp = create<AppState>((set, get) => ({
  user: loadUser(),
  // 启动即按当前登录账号载入（未登录为空车库，首页/登录页不受影响）
  ...(loadUser() ? loadAccountData(loadUser()!.email) : { cars: [], reminders: [], bookings: [], prefs: defaultPrefs }),

  login: (email, nickname) => {
    // 默认昵称：邮箱取 @ 前缀；手机号脱敏显示（138****0001）
    const fallback = email.includes('@')
      ? email.split('@')[0]
      : email.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
    const u = { email, nickname: nickname?.trim() || fallback }
    saveUser(u)
    set({ user: u, ...loadAccountData(email) })
  },
  logout: () => {
    saveUser(null)
    set({ user: null, cars: [], reminders: [], bookings: [], prefs: defaultPrefs })
  },
  deleteAccount: () => {
    const u = get().user
    if (u) clearAccountData(u.email)
    saveUser(null)
    set({ user: null, cars: [], reminders: [], bookings: [], prefs: defaultPrefs })
  },

  setPrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),

  addCar: (input) => {
    const id = uid('c')
    const car: Car = {
      static: {
        id,
        plateNo: input.plateNo.trim(),
        brand: input.brand.trim(),
        model: input.model.trim(),
        year: input.year,
        fuelType: input.fuelType,
        purchaseDate: input.purchaseDate,
      },
      state: {
        mileage: input.mileage,
        mileageAt: input.mileageAt,
        insuranceExpiry: input.insuranceExpiry,
        inspectionExpiry: input.inspectionExpiry,
        lastMaintenanceMileage: input.lastMaintenanceMileage ?? input.mileage,
      },
      events: [],
    }
    const reminders = buildReminders(car)
    set((s) => ({ cars: [...s.cars, car], reminders: [...s.reminders, ...reminders] }))
    // 同步后端：成为档案主车（问识途/任务闭环基于它执行）；失败静默，本地档案不受影响
    void api
      .addCar({
        id, plateNo: car.static.plateNo, brand: car.static.brand, model: car.static.model,
        year: car.static.year, fuelType: car.static.fuelType, purchaseDate: car.static.purchaseDate,
        mileage: car.state.mileage, mileageAt: car.state.mileageAt,
        insuranceExpiry: car.state.insuranceExpiry, inspectionExpiry: car.state.inspectionExpiry,
        lastMaintenanceMileage: car.state.lastMaintenanceMileage,
      })
      .then((p) => {
        // 以后端返回的提醒 id 为准（避免前后端重复 id），仅合并本车范围
        set((s) => ({
          reminders: [...s.reminders.filter((r) => r.carId !== id), ...p.reminders.filter((r) => r.carId === id)],
        }))
      })
      .catch(() => {
        /* 后端不可达：本地提醒已建好，体验不受影响 */
      })
    return car
  },

  addBooking: (b) => {
    const id = uid('b')
    set((s) => ({ bookings: [{ ...b, id }, ...s.bookings] }))
    return id
  },
  setBookingStatus: (id, status) =>
    set((s) => ({ bookings: s.bookings.map((b) => (b.id === id ? { ...b, status } : b)) })),

  addEvent: (carId, e) =>
    set((s) => ({
      cars: s.cars.map((c) =>
        c.static.id === carId
          ? { ...c, events: [{ ...e, id: uid('e'), carId }, ...c.events] }
          : c,
      ),
    })),

  reminderDone: (id) =>
    set((s) => ({ reminders: s.reminders.map((r) => (r.id === id ? { ...r, status: 'done' } : r)) })),
  reminderSnooze: (id) =>
    set((s) => ({ reminders: s.reminders.map((r) => (r.id === id ? { ...r, status: 'snoozed' } : r)) })),

  /** 任务闭环完成后，用服务端档案（含回写结果）合并刷新本地镜像：按 carId 范围替换，保留本地其他车辆 */
  hydrate: (p) =>
    set((s) => {
      const cars = [...s.cars]
      for (const c of p.cars) {
        const i = cars.findIndex((x) => x.static.id === c.static.id)
        if (i >= 0) cars[i] = c
        else if (s.cars.length === 0) cars.push(c)
      }
      const ids = new Set(p.cars.map((c) => c.static.id))
      return {
        cars,
        reminders: [...s.reminders.filter((r) => !ids.has(r.carId)), ...p.reminders],
        bookings: [...s.bookings.filter((b) => !ids.has(b.carId)), ...p.bookings],
      }
    }),

  resetDemo: () => {
    const u = get().user
    if (u && isDemoAccount(u.email)) {
      set({ cars: seedCars, reminders: seedReminders, bookings: seedBookings, prefs: defaultPrefs })
    } else {
      // 普通账号：清空自建档案（重新从空车库开始）
      set({ cars: [], reminders: [], bookings: [] })
    }
  },
}))

/** 档案变更即落盘（按当前登录账号隔离；未登录不落盘） */
useApp.subscribe((s) => {
  if (!s.user) return
  saveAccountData(s.user.email, { cars: s.cars, reminders: s.reminders, bookings: s.bookings, prefs: s.prefs })
})
