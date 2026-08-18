import { create } from 'zustand'
import type { Car, Reminder, Booking, UserPrefs, CarEvent } from '@shitu/shared'
import { seedCars, seedReminders, seedBookings, defaultPrefs } from '../api/mock'

interface User {
  email: string
  nickname: string
}

interface AppState {
  user: User | null
  cars: Car[]
  reminders: Reminder[]
  bookings: Booking[]
  prefs: UserPrefs
  login: (email: string) => void
  logout: () => void
  deleteAccount: () => void
  setPrefs: (p: Partial<UserPrefs>) => void
  addBooking: (b: Omit<Booking, 'id'>) => string
  setBookingStatus: (id: string, status: Booking['status']) => void
  addEvent: (carId: string, e: Omit<CarEvent, 'id' | 'carId'>) => void
  reminderDone: (id: string) => void
  reminderSnooze: (id: string) => void
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

/** 演示数据持久化：跨标签/刷新不丢（真实实现为 Turso 入库） */
const PERSIST_KEY = 'shitu_demo_v1'
interface Persisted {
  cars: Car[]
  reminders: Reminder[]
  bookings: Booking[]
  prefs: UserPrefs
}
const loadPersisted = (): Partial<Persisted> | null => {
  try {
    return JSON.parse(localStorage.getItem(PERSIST_KEY) ?? 'null')
  } catch {
    return null
  }
}
const saved = loadPersisted()

export const useApp = create<AppState>((set) => ({
  user: loadUser(),
  cars: saved?.cars ?? seedCars,
  reminders: saved?.reminders ?? seedReminders,
  bookings: saved?.bookings ?? seedBookings,
  prefs: saved?.prefs ?? defaultPrefs,

  login: (email) => {
    const u = { email, nickname: email.split('@')[0] }
    saveUser(u)
    set({ user: u })
  },
  logout: () => {
    saveUser(null)
    set({ user: null })
  },
  deleteAccount: () => {
    saveUser(null)
    set({ user: null, cars: seedCars, reminders: seedReminders, bookings: seedBookings, prefs: defaultPrefs })
  },

  setPrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),

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

  /** 任务闭环完成后，用服务端档案（含回写结果）整体刷新本地镜像 */
  hydrate: (p) => set({ cars: p.cars, reminders: p.reminders, bookings: p.bookings }),

  resetDemo: () =>
    set({ cars: seedCars, reminders: seedReminders, bookings: seedBookings, prefs: defaultPrefs }),
}))

/** 演示数据变更即落盘 */
useApp.subscribe((s) => {
  try {
    const p: Persisted = { cars: s.cars, reminders: s.reminders, bookings: s.bookings, prefs: s.prefs }
    localStorage.setItem(PERSIST_KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
})
