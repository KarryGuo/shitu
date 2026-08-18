import type { Car, Reminder, Booking, CarEvent } from '@shitu/shared'
import { mutate, uid, nowIso } from './store.js'

/**
 * 车辆档案域（§4.1）：与前端原型同源的样例数据。
 * 合规说明：全部为构造样例，不涉及任何真实车主个人信息（docs/data-compliance.md）。
 */

const seedCar: Car = {
  static: {
    id: 'c1',
    plateNo: '湘L·D8296',
    brand: '品牌汽车',
    model: '2022 款 · 旗舰版',
    year: 2022,
    fuelType: '汽油',
    purchaseDate: '2022-06-15',
  },
  state: {
    mileage: 43200,
    mileageAt: '2026-08-01',
    insuranceExpiry: '2026-11-02',
    inspectionExpiry: '2026-09-30',
    lastMaintenanceAt: '2025-09-10',
    lastMaintenanceMileage: 39000,
  },
  events: [
    { id: 'e3', carId: 'c1', type: 'part', occurredAt: '2025-03-18', title: '更换空调滤芯', detail: '22,000 km 时于连锁养护店更换' },
    { id: 'e2', carId: 'c1', type: 'maintenance', occurredAt: '2025-09-10', title: '常规保养', detail: '机油 + 机滤更换，4S 店，花费 ¥620' },
    { id: 'e1', carId: 'c1', type: 'repair', occurredAt: '2024-11-02', title: '左前雾灯更换', detail: '石子击碎后更换原厂件，¥260' },
  ],
}

const seedReminders: Reminder[] = [
  { id: 'r1', carId: 'c1', kind: 'maintenance', title: '常规保养 · 手册周期已到', dueAt: '2026-08-20', status: 'pending' },
  { id: 'r2', carId: 'c1', kind: 'inspection', title: '年检到期', dueAt: '2026-09-30', status: 'pending' },
  { id: 'r3', carId: 'c1', kind: 'insurance', title: '交强险 + 商业险到期', dueAt: '2026-11-02', status: 'pending' },
]

const seedBookings: Booking[] = [
  {
    id: 'b0',
    carId: 'c1',
    shopName: '品牌 4S 店',
    startsAt: '2025-09-10 10:00',
    items: '机油 + 机滤',
    priceEstimate: '¥620',
    status: 'done',
  },
]

export function seedProfile() {
  return {
    cars: [JSON.parse(JSON.stringify(seedCar)) as Car],
    reminders: JSON.parse(JSON.stringify(seedReminders)) as Reminder[],
    bookings: JSON.parse(JSON.stringify(seedBookings)) as Booking[],
  }
}

export function getProfile() {
  const s = mutate((x) => x)
  return { cars: s.profile.cars, reminders: s.profile.reminders, bookings: s.profile.bookings }
}

export function resetProfile() {
  mutate((s) => {
    s.profile = seedProfile()
  })
}

export function getCar(carId: string): Car {
  const car = mutate((s) => s.profile.cars.find((c) => c.static.id === carId))
  if (!car) throw new Error(`CAR_NOT_FOUND:${carId}`)
  return car
}

/** 档案回写：事件域追加（任务闭环最后一步） */
export function addEvent(carId: string, e: Omit<CarEvent, 'id' | 'carId'>): CarEvent {
  return mutate((s) => {
    const ev: CarEvent = { ...e, id: uid('e'), carId }
    const car = s.profile.cars.find((c) => c.static.id === carId)
    if (car) car.events.unshift(ev)
    return ev
  })
}

export function addBooking(b: Omit<Booking, 'id'>): Booking {
  return mutate((s) => {
    const booking: Booking = { ...b, id: uid('b') }
    s.profile.bookings.unshift(booking)
    return booking
  })
}

export function markReminderDone(id: string) {
  mutate((s) => {
    const r = s.profile.reminders.find((x) => x.id === id)
    if (r) r.status = 'done'
  })
}

/** 演示用"今天"：保证场景确定性（样例数据的到期日均以此为基准） */
export const DEMO_TODAY = new Date('2026-08-18T09:00:00+08:00')
export const todayIso = () => nowIso()
