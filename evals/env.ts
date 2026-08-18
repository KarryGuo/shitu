/**
 * eval 运行环境（必须在 runner 首个 import，先于 tools/store 模块初始化）：
 * - :memory: 内存库（不污染本地数据）
 * - CARE_PACE=0 全速执行
 * - LLM_PROVIDER=rule 确定性断言（架构 §12：mock 固定种子）
 */
process.env.DATABASE_URL ??= ':memory:'
process.env.CARE_PACE ??= '0'
process.env.LLM_PROVIDER ??= 'rule'
process.env.CONFIRM_SECRET ??= 'shitu-eval-secret'
