import type { Car } from '@shitu/shared'

/**
 * 规则引擎（§0 架构原则 5「LLM 可降级」）：
 * 核心提醒链路为纯逻辑实现，不依赖 LLM 也能可靠工作。
 */

export interface SenseResult {
  triggered: boolean
  reasons: string[]
  mileage: number
  kmSinceLast: number
  monthsSinceLast: number
  season: string
}

const MONTH_MS = 30.44 * 86400_000

/** 保养到期判断：手册周期（1 万公里 / 12 个月）先到为准，提前 30 天进入预警窗 */
export function senseMaintenance(car: Car, today = new Date()): SenseResult {
  const st = car.state
  const kmSinceLast = st.mileage - (st.lastMaintenanceMileage ?? 0)
  const monthsSinceLast = Math.round((today.getTime() - new Date(st.lastMaintenanceAt ?? today).getTime()) / MONTH_MS)
  const month = today.getMonth() + 1
  const season = month >= 6 && month <= 9 ? '雨季将至' : month >= 10 || month <= 2 ? '冬季将至' : '换季'

  const reasons: string[] = []
  if (kmSinceLast >= 10000) reasons.push(`已行驶 ${kmSinceLast.toLocaleString()} km，达到手册里程周期`)
  else if (kmSinceLast >= 7000) reasons.push(`本周期已行驶 ${kmSinceLast.toLocaleString()} km（周期 10,000 km）`)
  if (monthsSinceLast >= 12) reasons.push(`距上次保养 ${monthsSinceLast} 个月，达到手册时间周期`)
  else if (monthsSinceLast >= 11) reasons.push(`距上次保养 ${monthsSinceLast} 个月，接近 12 个月周期`)

  const triggered = reasons.length > 0
  return { triggered, reasons, mileage: st.mileage, kmSinceLast, monthsSinceLast, season }
}
