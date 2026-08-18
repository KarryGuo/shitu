# 识途 ShiTu

> 识车之途 · 护你前路 —— 面向车主全生命周期的智能用车 Agent（GOAI 无界应用赛项 · AI+汽车）

识途为每一辆车建立持续更新的数字档案（静态 / 状态 / 事件三域），主动发现保养、年检、保险与理赔需求，
生成带依据的方案，经车主确认后调用工具完成预约与跟进 —— 把「人找服务」变成「服务找人」。

## 一键启动（本地复现）

要求：Node 20+，pnpm 10+。

```bash
pnpm install
pnpm dev:api   # 终端 1：任务引擎 API → http://localhost:8787
pnpm dev       # 终端 2：Web → http://localhost:5199（vite 代理 /api → 8787）
```

打开 http://localhost:5199 → 任意邮箱登录 → 「保养管家」→ 开始演示（详见下文「任务闭环演示」）。

> 默认无需任何 API Key：LLM 走规则链路，外部服务走模拟适配器，全功能可复现。
> 可选：在 `apps/api/.env` 配置 `LLM_PROVIDER=dashscope` + `DASHSCOPE_API_KEY` 启用真实 LLM 方案生成。

## 任务闭环演示（复赛 Demo 核心链路）

「保养管家」页的时间线**不是录播动画**，每一步都是后端编排器的真实执行结果：

```
感知(规则引擎) → 方案(手册检索工具 + LLM/规则生成) → 比价(门店搜索/比对/聚合工具)
→ 人工确认(HMAC token + 120s TTL，无确认不执行) → 执行(幂等预约 + 日历 + 提醒) → 档案回写
```

页面上提供**异常演练**开关（对应复赛评审「异常处理」要求）：

| 演练 | 注入点 | 降级行为 | 结果 |
|---|---|---|---|
| 门店搜索超时 | `shopSearch` 工具 | 自动切换缓存报价，UI 标注「缓存 / 可能过期」 | 链路不中断，任务照常完成 |
| LLM 不可用 | LLM 适配器 | 方案生成降级为规则链路，步骤标注 provider | 内容确定性不受影响 |

其他可现场验证的可信机制：

- **确认超时作废**：确认卡放置 120 秒不操作 → 任务自动作废，档案零写入（时间线可见「确认超时」步骤）
- **拒绝路径**：点「再想想」→ 任务取消，无任何写操作
- **审计留痕**：`GET http://localhost:8787/api/audit` 可查每步 actor/action（运行证据）
- **重启恢复**：等待确认中的任务在 API 重启后仍可确认；执行中的任务标记 `interrupted` 安全中断

## 测试

```bash
pnpm --filter @shitu/api test    # 6 个用例：完整链路/拒绝/超时/两种降级/幂等
pnpm typecheck                   # 全 workspace TS strict
pnpm build                       # web + api 构建
```

用例细节见 [docs/TESTING.md](docs/TESTING.md)。

## API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/care/runs` | 创建保养任务（body: `{ inject?: 'none'\|'shop_timeout'\|'llm_down' }`） |
| GET | `/api/runs/:id` | 轮询运行状态（steps / confirm / degradations） |
| POST | `/api/runs/:id/confirm` | 确认或拒绝（body: `{ decision, token }`，token 为确认单 HMAC） |
| GET | `/api/profile` | 车辆档案（cars / reminders / bookings） |
| POST | `/api/profile/reset` | 重置演示数据 |
| GET | `/api/audit` | 审计日志（最近 50 条） |
| GET | `/healthz` `/readyz` | 健康 / 就绪检查 |

错误码：`CONFIRM_EXPIRED`(410) `CONFIRM_TOKEN_INVALID`(403) `RUN_NOT_WAITING`(409) `RUN_NOT_FOUND`(404)。

## 架构

```
apps/web   React 18 + Vite + Tailwind（移动端优先 PWA，国道公路视觉系统）
apps/api   Fastify 任务引擎
  ├─ orchestrator.ts   care 编排状态机（步骤留痕 / 降级 / 确认 / 回写）
  ├─ tools.ts          工具适配层（手册检索、门店比价、幂等预约、日历、提醒）
  ├─ llm.ts            LLM 适配器（DashScope Qwen，失败自动降级规则链路）
  ├─ rules.ts          规则引擎（保养到期判断，纯逻辑不依赖 LLM）
  ├─ store.ts          状态仓储（JSON 落盘 + 重启恢复；生产换 Turso/libSQL）
  └─ routes.ts         REST 路由（zod 校验）
packages/shared  前后端共享契约（DTO / 错误码 / 档案三域模型）
```

架构决策与模块边界的完整依据见 `识途_技术架构.md`（仓库外文档）。
数据合规说明见 [docs/data-compliance.md](docs/data-compliance.md)。

## 部署（Render）

`render.yaml` 定义 `shitu-web`（Static Site）与 `shitu-api`（Web Service）两个服务；
API 依赖免费实例会休眠，状态经 `data/state.json` 落盘，唤醒后 `waiting` 任务可继续确认。

## 目录约定

- `apps/api/data/` 运行时状态（已 gitignore）
- 演示"今天"固定为 2026-08-18（`profile.ts DEMO_TODAY`），保证样例数据到期场景确定性
