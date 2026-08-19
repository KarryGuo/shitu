/** 统一错误码（与 API `{ code, message }` 对应） */
export const ErrorCodes = {
  CAR_NOT_FOUND: 'CAR_NOT_FOUND',
  CONFIRM_EXPIRED: 'CONFIRM_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

export interface ApiError {
  code: ErrorCode | string
  message: string
  details?: unknown
}

/** 车辆档案 · 三域模型（§4.1 profile 域） */
export interface CarStatic {
  id: string
  plateNo: string
  brand: string
  model: string
  year: number
  fuelType: string
  purchaseDate: string
}

export interface CarState {
  mileage: number
  mileageAt: string
  insuranceExpiry: string
  inspectionExpiry: string
  lastMaintenanceAt?: string
  lastMaintenanceMileage?: number
}

export type CarEventType = 'maintenance' | 'repair' | 'accident' | 'claim' | 'part'

export interface CarEvent {
  id: string
  carId: string
  type: CarEventType
  occurredAt: string
  title: string
  detail: string
}

export interface Car {
  static: CarStatic
  state: CarState
  events: CarEvent[]
}

export type ReminderKind = 'inspection' | 'insurance' | 'maintenance' | 'custom'
export type ReminderStatus = 'pending' | 'notified' | 'done' | 'snoozed'

export interface Reminder {
  id: string
  carId: string
  kind: ReminderKind
  title: string
  dueAt: string
  status: ReminderStatus
}

export type BookingStatus = 'proposed' | 'confirmed' | 'done' | 'cancelled'

export interface Booking {
  id: string
  carId: string
  shopName: string
  startsAt: string
  items: string
  priceEstimate: string
  status: BookingStatus
}

/** Agent 运行（§7） */
export type RunScenario = 'care' | 'claim' | 'trip' | 'trade'
export type RunStepKind = 'plan' | 'llm' | 'tool' | 'confirm' | 'notify'

export interface UserPrefs {
  budget: string
  time: string
  frequentShop: string
}

/* ===================== 任务闭环 API 契约（§7 Agent 运行时） ===================== */

/** 运行状态：waiting=等待人工确认；interrupted=服务重启时仍在执行（可重新发起） */
export type RunStatus = 'running' | 'waiting' | 'done' | 'failed' | 'cancelled' | 'interrupted'

export type StepKind =
  | 'sense' | 'tool' | 'plan' | 'quote' | 'user' | 'confirm' | 'execute' | 'writeback' | 'done' | 'error'

export type InjectMode = 'none' | 'shop_timeout' | 'llm_down' | 'insurer_timeout'

/** 理赔决策选项（自费 / 走保险） */
export type ClaimChoice = 'self' | 'claim'
export interface ChoiceOption {
  id: ClaimChoice
  label: string
  price: string
  note: string
  badge?: string
}

/** 多模态定损结果（Qwen-VL，失败降级规则） */
export interface AssessDTO {
  part: string
  severity: string
  range: string
  confidence: number
  repurchase: string
  provider: string
  degraded: boolean
  note?: string
}

/** 单个工具调用的审计记录 */
export interface ToolCallRecord {
  name: string
  status: 'running' | 'ok' | 'failed' | 'degraded'
  latencyMs?: number
  note?: string
}

/** 比价表行 */
export interface QuoteRow {
  name: string
  price: number
  distance: string
  rating: number
  note?: string
  best?: boolean
  source: 'live' | 'cache'
}

/** 确认单（§7.4：涉及花费的动作无确认不执行） */
export interface ConfirmationDTO {
  id: string
  title: string
  lines: string[]
  /** HMAC token：前端回传，服务端校验（防伪造/防篡改） */
  token: string
  expiresAt: string
  secondsLeft: number
}

/** 时间线步骤（前端按 kind 映射视觉） */
export interface RunStepDTO {
  seq: number
  kind: StepKind
  seal: string
  title: string
  /** 正文行；**加粗** 由前端渲染 */
  body?: string
  tools?: ToolCallRecord[]
  table?: QuoteRow[]
  confirm?: ConfirmationDTO
  /** 理赔：定损结果（结构化，前端渲染表格） */
  assess?: AssessDTO
  /** 理赔：决策选项（自费/走保险），等待车主选择 */
  options?: ChoiceOption[]
  degraded?: boolean
  error?: string
  at: string
}

export interface RunDTO {
  id: string
  scenario: RunScenario
  status: RunStatus
  inject: InjectMode
  steps: RunStepDTO[]
  /** 降级说明（异常处理证据） */
  degradations: string[]
  /** 理赔：车主已做的决策 */
  choice?: ClaimChoice
  /** 理赔：等待车主选择（无 TTL，与确认单区分） */
  choicePending?: boolean
  createdAt: string
  finishedAt?: string
}

/** GET /api/profile */
export interface ProfileDTO {
  cars: Car[]
  reminders: Reminder[]
  bookings: Booking[]
}

/** 审计日志条目（运行证据；admin = 管理后台操作） */
export interface AuditEntry {
  at: string
  actor: 'agent' | 'user' | 'system' | 'admin'
  action: string
  detail?: string
  runId?: string
}
