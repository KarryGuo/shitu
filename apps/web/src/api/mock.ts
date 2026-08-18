import { useEffect } from 'react'
import type { Car, Reminder, Booking, UserPrefs } from '@shitu/shared'

/** 与初赛原型 / seed 同源的样例数据（§4.1：档案三域） */
export const seedCars: Car[] = [
  {
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
  },
]

export const seedReminders: Reminder[] = [
  { id: 'r1', carId: 'c1', kind: 'maintenance', title: '常规保养 · 手册周期已到', dueAt: '2026-08-20', status: 'pending' },
  { id: 'r2', carId: 'c1', kind: 'inspection', title: '年检到期', dueAt: '2026-09-30', status: 'pending' },
  { id: 'r3', carId: 'c1', kind: 'insurance', title: '交强险 + 商业险到期', dueAt: '2026-11-02', status: 'pending' },
]

export const seedBookings: Booking[] = [
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

export const defaultPrefs: UserPrefs = {
  budget: '适中（¥400–700）',
  time: '周末上午',
  frequentShop: '畅行连锁养护',
}

export interface ShopQuote {
  name: string
  price: number
  distance: string
  rating: number
  note?: string
  best?: boolean
}

/** 保养三方比价（§8.1 闭环第 4 步，与原型同源） */
export const careQuotes: ShopQuote[] = [
  { name: '畅行连锁养护', price: 486, distance: '1.2 km', rating: 4.8, note: '含免费全车检测 · 周六上午有空位', best: true },
  { name: '顺达认证修理厂', price: 452, distance: '3.4 km', rating: 4.5 },
  { name: '品牌 4S 店', price: 738, distance: '5.1 km', rating: 4.7 },
]

/** 理赔测算（§8.2，与原型同源口径） */
export const claimAssess = {
  part: '右后车门',
  severity: '轻度划伤 + 浅凹陷',
  range: '380–520 元',
  confidence: 0.86,
  repurchase: '无需补拍，光照充足',
}

/** 模拟网络延迟，让演示节奏接近真实 Agent */
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
