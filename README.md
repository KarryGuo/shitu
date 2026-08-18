# 识途 ShiTu

> 识车之途 · 护你前路 —— 面向车主全生命周期的智能用车 Agent

识途为每一辆车建立持续更新的数字档案（静态 / 状态 / 事件三域），主动发现保养、年检、保险与理赔需求，生成带依据的方案，经车主确认后调用工具完成预约与跟进，并把结果回写档案 —— 把「人找服务」变成「服务找人」。

## 在线体验

**https://shitu.onrender.com**

任意邮箱登录即可，无需注册。建议体验路径：

1. **档案** — 查看车辆数字档案与「车历长卷」
2. **保养** — 发起一次保养任务，观察感知 → 方案 → 比价 → 确认 → 执行 → 归档的完整闭环
3. **理赔** — 上传事故照片，体验多模态定损与自费 / 走保险决策
4. **审计** — 查看每次运行的工具调用、降级记录与审计日志

## 它能做什么

两个完整场景，均从感知到归档闭环：

- **保养管家（Care）**：规则引擎扫描档案（里程 / 时间 / 上次保养）→ 检索保养手册 + LLM 生成方案 → 多门店比价 → 车主确认 → 幂等预约 + 提醒 → 档案回写
- **理赔助手（Claim）**：上传事故照片 → 多模态定损（Qwen-VL）→ 自费 / 走保险决策参考 → 车主选择 → HMAC 确认单 → 材料清单 + 门店匹配 → 归档

时间线上的每一步都是后端编排器的真实执行结果，含工具名、耗时与降级标注，不是前端动画。

## 可信机制（工程要点）

| 机制 | 实现 |
|---|---|
| 人工确认 | 确认单携带 HMAC token + TTL，无有效 token 不执行；超时自动作废，档案零写入 |
| 幂等执行 | 预约基于 runId 幂等，重复触发不会产生重复订单 |
| 降级链路 | 门店搜索超时 → 缓存报价（UI 标注「可能过期」）；LLM 不可用 → 规则链路（步骤标注 provider）；高德超时 → 演示数据 |
| 审计留痕 | 每步 actor / action / detail 入库，`/api/audit` 可查，页面「审计」可视化 |
| 重启恢复 | 等待确认中的任务重启后仍可确认；执行中的任务标记 `interrupted`，不产生半写状态 |
| 状态持久化 | Turso（libSQL）写透，未配置时降级本地文件库 |

## 本地启动

要求：Node 20+，pnpm 9+。

```bash
pnpm install
pnpm dev:api   # 终端 1：任务引擎 API → http://localhost:8787
pnpm dev       # 终端 2：Web → http://localhost:5199（vite 代理 /api → 8787）
```

打开 http://localhost:5199 → 任意邮箱登录 → 「保养」或「理赔」发起任务。

默认无需任何 API Key：LLM 走规则链路，外部服务走模拟适配器，全功能可用。可选配置见 `.env.example`：

| 变量 | 作用 | 不配置时 |
|---|---|---|
| `DASHSCOPE_API_KEY` | Qwen 文本方案生成 + Qwen-VL 照片定损 | 规则链路（界面如实标注） |
| `AMAP_KEY` | 高德周边搜索（充电 / 加油 / 洗车）实时数据 | 演示数据（界面标注） |
| `DATABASE_URL` | `libsql://xxx.turso.io`（配 `TURSO_AUTH_TOKEN`） | 本地文件库 `data/shitu.db` |

## 测试与评估

```bash
pnpm test          # 单元测试：完整链路 / 拒绝 / 超时 / 降级 / 幂等
pnpm eval          # 端到端评估：8 个用例（care/claim 正常 + 异常注入），产出 evals/report/report.md
pnpm typecheck     # 全 workspace TS strict
pnpm build         # web + api + packages 构建
```

eval 用例在内存库 + 规则 LLM 下确定性执行，报告含每用例步骤时间线、降级记录与档案增量。

## API 一览

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/care/runs` | 创建保养任务（`{ inject?: 'none'\|'shop_timeout'\|'llm_down' }`） |
| POST | `/api/claim/runs` | 创建理赔任务（`{ inject?: 'none'\|'insurer_timeout'\|'llm_down' }`） |
| GET | `/api/runs` / `/api/runs/:id` | 运行列表 / 轮询状态（steps / confirm / degradations） |
| POST | `/api/runs/:id/confirm` | 确认或拒绝（`{ decision, token }`，token 为确认单 HMAC） |
| POST | `/api/runs/:id/choose` | 理赔车主决策（自费 / 走保险） |
| GET | `/api/profile` | 车辆档案（cars / reminders / bookings） |
| POST | `/api/profile/reset` | 重置演示数据 |
| GET | `/api/tools/nearby?kind=charging\|gas\|wash` | 高德周边搜索（适配器） |
| GET | `/api/metrics` | 运行指标（成功率 / 降级运行 / 工具健康 / 适配器状态） |
| GET | `/api/audit` | 审计日志 |
| GET | `/healthz` `/readyz` | 健康 / 就绪检查 |

错误码：`CONFIRM_EXPIRED`(410) `CONFIRM_TOKEN_INVALID`(403) `RUN_NOT_WAITING`(409) `RUN_NOT_FOUND`(404)。

## 架构

```
apps/web          React 18 + Vite + Tailwind（移动端优先 PWA）
apps/api          Fastify 任务引擎（单服务，同时托管前端静态文件）
  ├─ orchestrator.ts   care / claim 编排状态机（步骤留痕 / 降级 / 确认 / 回写）
  ├─ tools.ts          工具适配层（手册检索、门店比价、幂等预约、日历、提醒）
  ├─ llm.ts            LLM 适配器（DashScope Qwen / Qwen-VL，失败自动降级规则链路）
  ├─ amap.ts           高德适配器（周边搜索：mock 默认，AMAP_KEY 切实时，失败降级）
  ├─ rules.ts          规则引擎（保养到期判断，纯逻辑不依赖 LLM）
  ├─ store.ts          状态仓储（内存缓存 + Turso 写透，重启恢复）
  └─ routes.ts         REST 路由（zod 校验）
packages/db       libSQL 客户端 + schema（cars / car_states / car_events / reminders / bookings / agent_runs / audit_log）
packages/shared   前后端共享契约（DTO / 错误码 / 档案三域模型）
evals/            端到端评估套件（用例 + runner + 报告）
```

## 部署（Render）

`render.yaml` 定义单个 Web 服务：构建时编译全部包，运行时 API 同源托管 `apps/web/dist`（SPA fallback），免 CORS 与反向代理。环境变量在 Dashboard 中按需填写（均可留空运行）。
