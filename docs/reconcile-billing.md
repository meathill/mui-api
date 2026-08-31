# 对账手册 — hHMqR5nutGAq0m5ixwH5X0hqtytil61Q / 8-30+8-31 Grok+Claude+DeepSeek(含 Go)

> 目标：用两日窗口（UTC 与 CST 双档）横向对比 D1 `usage_logs` / WalletDO / KV / 原厂账单，定位 $3.7 vs $17.51 差额。

## 1. 一键对账（只读，Node.js 26 原生跑 .ts，无需 tsx）

```bash
# UTC 档（D1 默认时区）
node scripts/reconcile-billing.ts --user hHMqR5nutGAq0m5ixwH5X0hqtytil61Q

# CST 档（与北京时间/原厂可能时区对齐，+8 小时）
node scripts/reconcile-billing.ts --user hHMqR5nutGAq0m5ixwH5X0hqtytil61Q --tz CST

# 指定 8/30 单日 / 8/31 单日
node scripts/reconcile-billing.ts --user hHMqR5nutGAq0m5ixwH5X0hqtytil61Q --from 2026-08-30 --to 2026-08-31 --tz UTC
node scripts/reconcile-billing.ts --user hHMqR5nutGAq0m5ixwH5X0hqtytil61Q --from 2026-08-31 --to 2026-09-01 --tz UTC
```

脚本内部执行的 4 条 D1 SQL 已在 stdout 打印，可直接复制到 `wrangler d1 execute` 复核。

## 2. 手动复核命令

```bash
# 模型表完整性（若缺行会回退 gpt-4o-mini 0.15/0.6，导致低估 10 倍+；列名用 snake_case）
npx wrangler d1 execute mui-api --remote --command "SELECT id, provider, input_price, output_price, markup_rate FROM models WHERE id IN ('grok-4.6','grok-4.5','claude-sonnet-4-6','deepseek-v4-pro')"

# KV 镜像（余额 / freeQuotaUsed）
npx wrangler kv key get --binding=KV --remote "user:hHMqR5nutGAq0m5ixwH5X0hqtytil61Q" | jq .

# 近 1 小时计费失败 / 定价缺失（H1/H2 信号）
npx wrangler tail mui-api --format json | grep -E "计费失败|原生代理.*失败|usage 提取失败|\\[billing\\]"

# DeepSeek 经 Go 的量（Go 后台另查）
# 若 D1 中 deepseek cnt=0 但 Go 后台有量 → usage shape 不兼容（H3）
```

## 3. 报表解读

| 现象 | 结论 |
|------|------|
| `2. 分 provider` 中 Grok+Claude+DeepSeek 的 `sum(totalCost)` 已接近 17.51，但 Dashboard 显示 3.7 | 口径为 `chargedCost`（扣过 freeQuota），非漏记。对比 `freeQuota` 配置 |
| `2.` 中 `provider` 列出现 `NULL` 且 `cnt>0` | H2 定价缺行，回退低价 |
| DeepSeek `cnt=0` 但 Go 后台有量 | H3 Go shape 未识别（已在 `usage-extractor.ts:54-79` 兜底修复） |
| Gateway 请求数 ≫ D1 `cnt` | H1 异步丢失（`waitUntil`/`tee`） |

## 4. 修复已落地

- `packages/app/src/services/usage-extractor.ts:30-79`：补齐 `zai/qwen/minimax/meta/longcat/hy` 并增加 `default` 兜底按 OpenAI 解析，避免未知 provider 静默丢弃。
- `packages/app/src/services/billing-service.ts:203-215`：定价缺失日志前缀 `[billing]` 便于 tail 告警。
- `packages/app/src/routes/providers.ts:1-129`：原生代理流式/非流式均按 `usage.model` 查 `modelCatalog.getById` 取真实 `modelPricing`，不再无脑 `null` 回退。
- `scripts/reconcile-billing.ts:4d/4e`：新增 `video_generation_jobs` 统计 — Grok 视频为异步任务，`usage_logs` 仅在 `GET /v1/videos/:id` 轮询到 `done` 时插入（本窗口 `5/16` 已结算），`pending` 的 `estimated_cost` 不在 `usage_logs` 但已在 `WalletDO` 预占，需单独统计才与 Grok 控制台的提交数 `16` 对齐。

## 5. 口径说明（Grok 16 vs 5 / Cloudflare 更多）

- **Grok 16 vs 内部 5**：`video_generation_jobs` 本窗口 `totalJobs=16 / done=5 / pending=11 / totalEstimated=$5.914 / totalSettled=$1.534`（`04d/04e`）。`usage_logs` 只含 `done` 的 `$1.534`，`pending` 的 `$4.38` 已预占余额但未结算，Grok 控制台按提交计 `16`。
- **Cloudflare 统计更多**：AI Gateway 对 `POST /v1/videos/generations` + 每个 `GET /v1/videos/:id` 轮询（1 个 job 轮询 3-5 次）+ `POST /v1/images/generations` 均计为独立请求，故网关请求数 > Grok job 数，属正常。
- **修正总额**：该用户近两日真实消耗应为 `usage_logs $6.727 + pending 视频估算 $4.38 = $11.107`，而非单看 `usage_logs`。
