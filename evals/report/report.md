# 识途 · eval 运行报告（复赛运行证据）

- 运行时间：2026-08-18T15:08:11.539Z
- 环境：DATABASE_URL=`:memory:` · LLM_PROVIDER=`rule` · CARE_PACE=`0` · Node v24.11.1
- 结果：**8/8 通过** · 总耗时 1116 ms

| # | 用例 | 场景 | 注入 | 终态 | 降级 | 结果 |
|---|------|------|------|------|------|------|
| 1 | care-confirm-expired | care | none | failed | 否 | PASS |
| 2 | care-happy | care | none | done | 否 | PASS |
| 3 | care-llm-down | care | llm_down | done | 是 | PASS |
| 4 | care-reject | care | none | cancelled | 否 | PASS |
| 5 | care-shop-timeout | care | shop_timeout | done | 是 | PASS |
| 6 | claim-happy | claim | none | done | 否 | PASS |
| 7 | claim-insurer-timeout | claim | insurer_timeout | done | 是 | PASS |
| 8 | claim-llm-down | claim | llm_down | done | 是 | PASS |

## care-confirm-expired — 保养闭环 · 确认超时 → 任务作废（无确认不执行）

- run：`run_msysrrqv1` · 终态 `failed` · 耗时 113 ms
- 档案增量：预约 +0 · 事件 +0

| seq | 步骤 | 标题 | 降级 |
|-----|------|------|------|
| 1 | sense | 识途 · 主动感知 | 否 |
| 2 | plan | 识途 · 保养方案（rule） | 否 |
| 3 | quote | 识途 · 三方比价 | 否 |
| 4 | user | 车主 | 否 |
| 5 | confirm | 识途 · 停车确认（无确认不执行） | 否 |
| 6 | error | 识途 · 确认超时 | 否 |

## care-happy — 保养闭环 · 正常链路（感知→方案→比价→确认→执行→归档）

- run：`run_msysrru0c` · 终态 `done` · 耗时 165 ms
- 档案增量：预约 +1 · 事件 +1

| seq | 步骤 | 标题 | 降级 |
|-----|------|------|------|
| 1 | sense | 识途 · 主动感知 | 否 |
| 2 | plan | 识途 · 保养方案（rule） | 否 |
| 3 | quote | 识途 · 三方比价 | 否 |
| 4 | user | 车主 | 否 |
| 5 | confirm | 识途 · 停车确认（无确认不执行） | 否 |
| 6 | user | 车主 | 否 |
| 7 | execute | 识途 · 执行 | 否 |
| 8 | writeback | 识途 · 已办完 | 否 |
| 9 | done | 任务闭环 | 否 |

## care-llm-down — 保养闭环 · LLM 不可用 → 规则链路降级，方案仍生成

- run：`run_msysrrymt` · 终态 `done` · 耗时 160 ms
- 档案增量：预约 +1 · 事件 +1
- 降级链路：「LLM 不可用，已降级为规则链路生成方案（内容确定性不受影响）」

| seq | 步骤 | 标题 | 降级 |
|-----|------|------|------|
| 1 | sense | 识途 · 主动感知 | 否 |
| 2 | plan | 识途 · 保养方案（rule-fallback） | ⚠ 是 |
| 3 | quote | 识途 · 三方比价 | 否 |
| 4 | user | 车主 | 否 |
| 5 | confirm | 识途 · 停车确认（无确认不执行） | 否 |
| 6 | user | 车主 | 否 |
| 7 | execute | 识途 · 执行 | 否 |
| 8 | writeback | 识途 · 已办完 | 否 |
| 9 | done | 任务闭环 | 否 |

## care-reject — 保养闭环 · 拒绝确认 → 无执行零写入

- run：`run_msysrs321a` · 终态 `cancelled` · 耗时 114 ms
- 档案增量：预约 +0 · 事件 +0

| seq | 步骤 | 标题 | 降级 |
|-----|------|------|------|
| 1 | sense | 识途 · 主动感知 | 否 |
| 2 | plan | 识途 · 保养方案（rule） | 否 |
| 3 | quote | 识途 · 三方比价 | 否 |
| 4 | user | 车主 | 否 |
| 5 | confirm | 识途 · 停车确认（无确认不执行） | 否 |
| 6 | done | 识途 · 已取消 | 否 |

## care-shop-timeout — 保养闭环 · 门店搜索超时 → 缓存报价降级，任务仍完成

- run：`run_msysrs681l` · 终态 `done` · 耗时 193 ms
- 档案增量：预约 +1 · 事件 +1
- 降级链路：「门店开放平台响应超时（2×0ms），已降级为本地缓存报价，价格可能过期」

| seq | 步骤 | 标题 | 降级 |
|-----|------|------|------|
| 1 | sense | 识途 · 主动感知 | 否 |
| 2 | plan | 识途 · 保养方案（rule） | 否 |
| 3 | quote | 识途 · 三方比价 | ⚠ 是 |
| 4 | user | 车主 | 否 |
| 5 | confirm | 识途 · 停车确认（无确认不执行） | 否 |
| 6 | user | 车主 | 否 |
| 7 | execute | 识途 · 执行 | 否 |
| 8 | writeback | 识途 · 已办完 | 否 |
| 9 | done | 任务闭环 | 否 |

## claim-happy — 理赔闭环 · 正常链路（照片→定损→决策→确认→材料与预约→归档）

- run：`run_msysrsbm22` · 终态 `done` · 耗时 107 ms
- 档案增量：预约 +1 · 事件 +1

| seq | 步骤 | 标题 | 降级 |
|-----|------|------|------|
| 1 | sense | 识途 · 已接收照片 | 否 |
| 2 | plan | 识途 · 定损结果（rule · 附置信度） | 否 |
| 3 | quote | 识途 · 决策参考：走保险还是自费？ | 否 |
| 4 | user | 车主 | 否 |
| 5 | confirm | 识途 · 停车确认（无确认不执行） | 否 |
| 6 | user | 车主 | 否 |
| 7 | execute | 识途 · 执行 | 否 |
| 8 | writeback | 识途 · 已办完 | 否 |
| 9 | done | 任务闭环 | 否 |

## claim-insurer-timeout — 理赔闭环 · 保险/门店平台超时 → 缓存方案降级，任务仍完成

- run：`run_msysrsel2l` · 终态 `done` · 耗时 117 ms
- 档案增量：预约 +1 · 事件 +1
- 降级链路：「保险/门店开放平台响应超时，已降级为本地缓存方案（营业信息可能变化，以门店确认为准）」

| seq | 步骤 | 标题 | 降级 |
|-----|------|------|------|
| 1 | sense | 识途 · 已接收照片 | 否 |
| 2 | plan | 识途 · 定损结果（rule · 附置信度） | 否 |
| 3 | quote | 识途 · 决策参考：走保险还是自费？ | 否 |
| 4 | user | 车主 | 否 |
| 5 | confirm | 识途 · 停车确认（无确认不执行） | 否 |
| 6 | user | 车主 | 否 |
| 7 | execute | 识途 · 执行 | ⚠ 是 |
| 8 | writeback | 识途 · 已办完 | 否 |
| 9 | done | 任务闭环 | 否 |

## claim-llm-down — 理赔闭环 · Qwen-VL 不可用 → 规则基准定损降级，走保险分支仍闭环

- run：`run_msysrshv34` · 终态 `done` · 耗时 140 ms
- 档案增量：预约 +1 · 事件 +1
- 降级链路：「视觉模型不可用，已降级为规则基准定损（建议人工核实）」

| seq | 步骤 | 标题 | 降级 |
|-----|------|------|------|
| 1 | sense | 识途 · 已接收照片 | 否 |
| 2 | plan | 识途 · 定损结果（rule-fallback · 附置信度） | ⚠ 是 |
| 3 | quote | 识途 · 决策参考：走保险还是自费？ | 否 |
| 4 | user | 车主 | 否 |
| 5 | confirm | 识途 · 停车确认（无确认不执行） | 否 |
| 6 | user | 车主 | 否 |
| 7 | execute | 识途 · 执行 | 否 |
| 8 | writeback | 识途 · 已办完 | 否 |
| 9 | done | 任务闭环 | 否 |
