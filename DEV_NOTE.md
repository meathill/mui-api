# 开发笔记

记录架构决策、技术选型依据、以及开发过程中积累的非显而易见的知识。

## 架构决策

### CF AI Gateway Stored Keys 认证

**决策**：优先用 CF AI Gateway Stored Keys 管理受支持 Provider 的凭证；Moonshot AI、Xiaomi MiMo 等直连 Provider 则使用 Worker secrets，具体分流见「AI Provider 路由分发」。

**原因**：
- 集中化凭证管理，Provider Key 不暴露在代码或环境变量中
- Gateway 路径只需 `CF_AIG_TOKEN`，由 CF Gateway 负责路由到正确的 Provider
- 支持两种代理模式：`compat`（OpenAI 兼容）和 `native`（Provider 原生端点）
- 认证头使用 `cf-aig-authorization: Bearer {CF_AIG_TOKEN}`

### KV + D1 + Durable Object 分层存储

**决策**：用户配置和展示镜像放 KV，并发准入 / 钱包账本放 Durable Object，持久化/可查询数据放 D1。

| 存储 | 用途 | 原因 |
|------|------|------|
| KV | `user:{userId}` 记录的只读展示镜像、API Key hash 验证、花费统计 | 每次请求都要读，需要亚 60ms 延迟；由 `WalletDO`/`ConcurrencyLimiterDO` 写回，业务代码不再直接写 |
| Durable Object | `ConcurrencyLimiterDO`：每用户活跃 lease、并发准入、过期清理；`WalletDO`：余额/免费额度/暂停状态/metadata 的唯一写者 | 同一用户状态天然串行，避免并发读改写丢更新（详见下面「钱包账本迁移到 Durable Object」） |
| D1 | 用户账户、使用日志、模型定价、花费限额、better-auth 表 | 需要 SQL 查询、聚合、关联 |

**KV Key 命名约定**：
- `user:{userId}` — 用户数据（余额、并发等），只读镜像，唯一写者是 `WalletDO`
- `apikey:{keyHash}` — API Key 到 userId 的映射
- `config:global` — 全局配置（每日/每月花费上限、服务暂停标志）
- `stats:daily:{date}` / `stats:monthly:{month}` — 全局花费统计（带 TTL）
- `spending:user:{userId}:{month}` — 用户月度花费（TTL 35 天）

### 钱包账本迁移到 Durable Object（WalletDO）

**背景**：早期实现里 `KVService.deductBalance/addBalance/consumeFreeQuota/suspendUser/unsuspendUser`（以及 dashboard 里独立复制的一份等价逻辑）都是对 `user:{userId}` 这条 KV 记录的读-改-写，不是原子操作。`ConcurrencyLimiterDO` 允许每用户最多 `maxConcurrency`（默认 3）个并发请求，意味着并发扣费时后写覆盖先写、静默丢失扣费是设计上就会触发的场景，不是理论边界情况。由于 `Math.max(0, ...)` 兜底，丢失的扣费只会让余额虚高（少扣钱），是持续的收入损失。

**决策**：新建 `WalletDO`（`packages/app/src/durable-objects/wallet.ts`），按 `idFromName(userId)` 分区，成为 `user:{userId}` 这条 KV 记录（`data` + `metadata` 两部分）的唯一写者。`packages/app` 和 `packages/dashboard`（跨 Worker 绑定，`script_name: "mui-api"`）都通过它读写余额，KV 变成两边共用的只读展示镜像。

**为什么不合并进 `ConcurrencyLimiterDO`**：职责分离（并发租约 vs 财务账本），避免让一个已经稳定在生产跑的类风险敞口变大；且合并不会带来正确性上的好处——DO 调用的串行化保证跟是否合并成一个类无关。

**自愈式迁移**：不做一次性 batch 迁移脚本。`WalletDO` 实例第一次收到请求时，若自己的 storage 还没有数据，从当前 KV 镜像 adopt 一次再继续。零停机，不会漏迁移任何用户。

**踩过的坑：`blockConcurrencyWhile` 用在哪一层**。最初的实现只在「首次 bootstrap（从 KV adopt）」这一步加了 `blockConcurrencyWhile`，以为 DO 的「一次只处理一个请求」保证会自动覆盖后续的稳态读-改-写。写了一个真并发的回归测试（`e2e/wallet-concurrency.test.ts`，用 `cloudflare:test` 的真实 DO 运行时对同一实例并发发起多个 `/deduct`）才发现：**DO 的 input/output gate 只保护 `ctx.storage` 操作之间的互斥**，一旦某个请求在两次 storage 操作之间 `await` 了外部 I/O（这里是 KV 读/写），其它并发请求就能插进来读到同一份旧值——稳态的读-改-写照样会丢更新，不只是首次 bootstrap。最终修复：把「读 storage → 应用变更 → 写 storage」整体包进 `blockConcurrencyWhile`（这段本身不含任何外部 I/O，符合官方「不要跨外部 I/O 持锁」的准则），KV 镜像同步放到锁外——镜像只是展示副本，偶尔与其它并发请求交错不影响 storage 里的权威账本。**教训：写涉及 DO 并发正确性的代码时，必须用真实 DO 运行时的并发测试验证，纯 mock 的单测测不出真正的并发语义。**

**本地开发限制**：`packages/dashboard`（Next.js / OpenNext，`next dev`）和 `packages/app`（`@cloudflare/vite-plugin`，`vite dev`）是两个独立的本地 dev 进程，不共享跨 Worker 的 service/DO 绑定发现机制。本地同时跑两个 dev server 时，dashboard 侧调用 `env.WALLET`（跨 Worker 绑定到 `mui-api`）会收到 "Service Unavailable"——这是本地工具链的已知限制，不是代码 bug；两个 Worker 都部署到 Cloudflare 后，跨 Worker DO 绑定按标准机制工作。本地要完整验证 dashboard 侧钱包写路径，需要用单个 `wrangler dev` 进程加载两份 config（未配置），或直接在预发环境验证。

### D1 Read Replication（Sessions API）

**决策**：`packages/app` 全局中间件（`src/middleware/d1-session.ts`）在每个请求开始时创建 `env.DB.withSession('first-unconstrained')`，通过 Hono context（`c.get('db')`）供该请求内所有 DB 访问复用；`packages/dashboard` 更简单，因为 `getDb()`（`src/lib/db.ts`）本来就是全仓库唯一入口，直接在里面包一层 session 即可，不需要 Next.js 中间件或跨请求 context 穿线。

**一致性策略：不做跨请求 bookmark 回传**。原因：余额真账本不在 D1（在 `WalletDO`），D1 里能读到的东西（`usage_logs`、`recharge_logs`、`lifetime_*` 聚合统计、`oauth_tokens` 校验）都是审计/统计类数据，副本延迟（通常亚秒级）造成的短暂陈旧对这些只读端点几乎无感知。本身是公开的 OpenAI 兼容 API，第三方 SDK 也不会配合回传自定义 bookmark header。

**类型兼容性**：drizzle-orm@0.45.1 的 `AnyD1Database` 类型未收录 `D1DatabaseSession`，但两者在 `prepare`/`batch` 上结构兼容（drizzle 的 D1 session 实现只调用这两个方法），`db/index.ts` 的 `createDb()` 内部做了一次 cast，是安全的。

**踩过的坑：Sessions API 会偶发 `Network connection lost`**。启用 Sessions API 后生产上出现间歇性登录失败（OAuth 社交登录写 `verification` 表时报 `SERVER_ERROR`），一开始怀疑是「D1 库过载」，但 `wrangler d1 insights` 查出的真实查询量很低（最高频查询 7 天才 780 次、均延迟 <1ms），量级远够不上过载，这个猜测被数据推翻。真正定位靠的是在 `getDb()`/`createDb()` 上加了一层诊断日志（先不重试，只记录完整错误链路），等到下次真实报错才拿到样本：

```
D1_ERROR: Network connection lost.
  caused by: Network connection lost.
```

抛出点是 `D1DatabaseSession._sendOrThrow`——只有走 Sessions API（`env.DB.withSession(...)`）才会经过的内部方法，说明这是 D1 read replication 引入的、和查询负载无关的瞬时网络错误，不是这个项目独有的问题（Cloudflare 官方在 workers-sdk issue 里确认过「D1 常见的瞬时性错误」这个说法）。**教训：判断「是不是过载」不能只凭错误信息里的字面意思（"overloaded"/"queued"这类词），要么拿 `d1 insights` 这样的真实指标验证，要么先加诊断日志拿到下一次的真实样本，再下结论。**

**修复**：新增 `packages/shared-db/src/d1-retry.ts` 的 `withD1Retry()`，包一层 `prepare/bind/run/all/raw/first/batch`（`batch()` 需要用 `WeakMap` 反解出真实的 `D1PreparedStatement` 再传给底层 `d1.batch()`，因为包装出来的壳对象不能直接喂给 workerd 的原生实现）。用白名单（而非黑名单）判断是否值得重试：只匹配已知的瞬时性错误特征（`overloaded`/`internal error`/`network`/`timeout`），约束/schema 类错误（`constraint failed`/`no such table`/`no such column`/`syntax error`）明确排除、不重试——这次的真实样本命中 `/network/i`，验证了分类逻辑。`packages/dashboard/src/lib/db.ts` 的 `getDb()` 和 `packages/app/src/db/index.ts` 的 `createDb()` 都接入了这层包装，因为两边都用同一个 D1 库、同一个 Sessions API 用法。

### 异步计费（waitUntil）

**决策**：计费在响应返回后异步执行，不阻塞 API 响应。

**实现**：
- 非流式：从 JSON response body 提取 usage
- 流式：用 `tee()` 分流 body，一份给客户端，一份给计费处理器
- 通过 `c.executionCtx.waitUntil()` 执行计费管道：计算费用 → `WalletDO` 扣余额 → D1 记日志 → 告警检查

**注意**：计费崩溃不影响已发送的响应。需要依赖告警系统发现计费异常。

### 模型白名单免费额度

**决策**：免费体验额度放在全局 KV 配置 `config:global.freeQuota`，用户侧只在 `user:{userId}.freeQuotaUsed` 记录已使用金额。

**原因**：
- 免费额度要能按模型白名单控制，优先用于 MiMo 等成本可控、希望推广的新模型
- 额度是全局策略，不需要逐用户发券；调高额度时用户自动获得差额，调低或关闭时立即生效
- 计费日志仍记录真实请求成本，实际钱包只扣除抵扣后的 `chargedCost`，便于统计真实成本与运营补贴
- Native provider 透传路由不使用免费额度，因为该路径无法可靠提前识别具体模型，避免绕过白名单准入

### 计费定价矩阵

**背景**：早期 `models` 表只有 `inputPrice` / `outputPrice`。接入 Anthropic cache 与长上下文分档后，定价扩展为「标准档 / 长上下文档 × 普通输入 / cache 命中输入 / cache 写入 / 输出」的矩阵，集中记录于此，避免口径散落各处。

**定价字段**（均为「每 100 万 token 美元单价」，存于 `models` 表）：

| token 类别 | 标准档 | 长上下文档 |
|------------|--------|-----------|
| 普通输入 | `inputPrice` | `longContextInputPrice` |
| cache 命中输入 | `cachedInputPrice` | `longContextCachedInputPrice` |
| cache 写入 | `cacheWritePrice` | `longContextCacheWritePrice` |
| 输出 | `outputPrice` | `longContextOutputPrice` |

**档位判定**：`contextSize = inputTokens + cachedInputTokens + cacheWriteTokens`；当配置了 `longContextThresholdTokens` 且 `contextSize` 超过阈值时走 `long_context` 档，否则 `standard`。

**回退规则**（字段为 `null` = 未配置）：长上下文价缺失回退到同名标准价；`cachedInputPrice` / `cacheWritePrice` 缺失回退到 `inputPrice`。

**计费公式**：`rawCost = Σ(各类 token × 对应单价) / 1e6`；`cost = rawCost × markupRate × userRateMultiplier`。

**扣费与记账**：`chargedCost = max(0, cost − freeQuotaDeducted)`，KV 只扣 `chargedCost`；D1 `usage_logs` 记录完整 `cost`、`tier` 及四类 token，用于区分真实成本与运营补贴。

**实现**：`billing-service.ts` 的 `calculateCost`（档位判定 + 回退）与 `processUsage`（免费额度 → KV 扣费 → D1 日志）。

### 图片模型计费粒度

**现状**：定价矩阵已覆盖 cache 与长上下文分档（见上），但仍按单一 `inputPrice` 计所有输入 token，未区分文本输入 token 与图片输入 token 的单价——而 OpenAI 图片模型两者单价并不相同。

**当前决策**：`gpt-image-2` 种子数据使用图片输入价作为 `inputPrice`，避免编辑图片时低估成本；纯文本生成场景会略高估输入成本，但图片输出通常占主要成本。

**后续优化**：如果图片调用量增加，需要把模型定价扩展为按 token 类型计费，例如 text input、image input、cached input、output 分列。

### AI Provider 路由分发 (Gateway vs. env.AI)

**决策**：根据不同 Provider 的特性采取不同的调用方式，不再一刀切地全部走 AI Gateway Stored Keys。

**实现**：
- **OpenAI / Google AI Studio**：继续走 CF AI Gateway，由其 Stored Keys 注入真实的 API Key。
- **Moonshot AI**：不走 CF AI Gateway，使用 `MOONSHOT_API_KEY` 直连 `https://api.moonshot.ai/v1/chat/completions`，可通过 `MOONSHOT_BASE_URL` 覆盖 base URL。Provider 标识为 `moonshot`，因此请求不会出现在 AI Gateway 日志中。
- **Xiaomi MiMo**：不走 CF AI Gateway，直接用 `MIMO_API_KEY` 请求 OpenAI 兼容接口，默认 base URL 为 `https://api.xiaomimimo.com/v1`，可通过 `MIMO_BASE_URL` 覆盖。Provider 标识为 `xiaomi-mimo`，计费 usage 按 OpenAI 兼容响应解析。
- **Anthropic (Claude)**：经 CF AI Gateway 转发，计费模式（unified 代付 / byok 自付，详见下方「只有 Claude 走 Unified Billing + BYOK 开关」一节）由 `ANTHROPIC_CREDENTIAL_MODE` 控制。两条对外面：原生 `/v1/messages` 走 provider-native 透传（`proxyNative`，`cf-aig-authorization` 固定带，unified 时另加 `Authorization: Bearer CF_TOKEN`、byok 时改成 `x-api-key`，返回 Anthropic 原生 usage）；OpenAI 兼容 `/v1/chat/completions` 走 compat 端点（`callAnthropicCompat`，`cf-aig-authorization` 固定带，unified 时不加别的、byok 时加 `Authorization: Bearer ANTHROPIC_API_KEY`，model 带 `anthropic/` 前缀，返回 OpenAI 形 usage）。upstreamModelId 用 Anthropic 规范连字符 ID（如 `claude-haiku-4-5`）。
  - **入站认证兼容 `x-api-key`**：Anthropic 官方 SDK / Claude Code 默认用 `x-api-key` 头而非 `Authorization: Bearer` 发送凭证，`authMiddleware` 两种头都接受（`middleware/auth.ts`），否则原生 SDK 直连会全部 401。
  - **早期误区订正**：曾以为 Claude 可走 `env.AI.run`（Workers AI binding）「免 Key、按 Workers AI 计费」——这是错的：Workers AI 不托管 Claude，且 Workers AI 模型走 Gateway 也不计入 Unified Billing。Claude 必须走 Unified Billing 代付。
- **Workers AI (`@cf/*`)**：走 `env.AI.run` + `gateway: { id }`，按 Workers AI 用量（neuron）计费，保留 Gateway 监控。
- **xAI Grok**：经 CF AI Gateway 转发，xAI key 以 Stored Keys 形式配置在网关侧（`callGrokEndpoint()` 只带 `cf-aig-authorization`，不注入 `Authorization`），本服务不持有真实 xAI key，接入模式与 OpenAI / Google AI Studio 一致。详见下方「xAI Grok 接入」一节。

### Moonshot AI Kimi K3 接入

**协议与能力**：`kimi-k3` 只接入 `/v1/chat/completions`，请求中的 `reasoning_effort`、tools、`tool_choice`、`response_format`、多模态 messages 与 stream 原样透传。K3 的上下文窗口为 1,048,576 tokens，当前只支持 `reasoning_effort=max` 且始终推理。Playground 默认 `max_completion_tokens=16384`，支持 PNG/JPEG/WebP/GIF 图片；原始文件合计限制为 50MB，避免 Base64 后逼近上游 100MB request 限制。历史只保存最终答案，不保存推理过程或上传文件。本轮不代理 `/v1/files`，因此不提供视频上传，也不新增 Responses API。

**计费**：1M context 全程统一使用 cache miss `$3/M`、cache hit `$0.30/M`、output `$15/M`，`markupRate=1.2`，不设置长上下文价格档位。非流式 usage 位于顶层；Kimi 流式 usage 位于最后一个 chunk 的 `choices[0].usage`。缓存输入优先兼容 OpenAI details 字段，并读取 Kimi 的 `usage.cached_tokens`；`completion_tokens` 已包含 reasoning tokens，不能重复累加。

### GPT-5.6 模型目录接入（Sol / Terra / Luna）

**决策**：`gpt-5.6-sol`（含短名 alias `gpt-5.6`）/ `gpt-5.6-terra` / `gpt-5.6-luna` 作为纯 `provider: 'openai'` 目录数据接入种子库，复用既有 OpenAI Chat Completions 路由分发与计费链路（`callOpenAI` + `openaiCacheWithWrite`），未新增任何 provider 专属代码路径或计价逻辑。

**定价**：官方 list price（$/1M tokens）：Sol $5/$30、Terra $2.5/$15、Luna $1/$6；cache write 统一为 input 的 1.25×（`openaiCacheWithWrite` helper，GPT-5.6 起生效，早于此的 GPT-5 系列 cache write 倍率不同，不要混用）。`markupRate` 统一 1.2。

**运营须知**：网关路由已经能转发这些 model id，但真实调用能否成功取决于 CF AI Gateway 上游是否已对这几个具体 model id 开通访问——本项目侧无法验证，接入当天未做真实调用冒烟，只验证了 format/typecheck/单测/构建。

### OpenAI Responses API 透传（/v1/responses，服务 Codex CLI）

**背景**：OpenAI Codex CLI 的自定义 provider 只支持 Responses API（`wire_api = "responses"`），不支持 Chat Completions；Cloudflare AI Gateway 官方文档已确认 `.../openai/responses` 是受支持的透传路径，与 `.../openai/chat/completions` 同构。

**决策**：新增 `routes/responses.ts` 独立文件（结构镜像 `anthropic.ts`：单一 provider 原生格式、handler 级 `authMiddleware`，不用 `.use('/*', ...)`，避免反向拦截 `openai.ts` 的同前缀路由），走 `callOpenAIEndpoint()` 原始 fetch 透传到 CF AI Gateway 的 `openai/responses` 端点，不用 `openai` SDK 的 `client.responses.create()`。原因：Responses API 字段面广且演进快（`tools`/`reasoning`/`store`/`previous_response_id`/`background` 等），原始透传不需要网关关心每个字段的类型定义；不注入任何默认字段，请求体完全由调用方掌控，网关只改写 `model` 为 `upstreamModelId`。仅服务 `provider === 'openai'` 的模型，其它一律 400 拒绝——Responses API 是 OpenAI 专属 wire format，没有跨 provider 转译的意义。

**计费兼容性修复**：`usage-extractor.ts` 的 `extractOpenAIUsage()` 原先只认 Chat Completions 的字段名（`prompt_tokens_details.cached_tokens`，且非流式/流式都假设 usage 在顶层），Responses API 用 `input_tokens_details.cached_tokens`，且流式场景 usage 只出现在终态 SSE 事件（`response.completed`/`incomplete`/`failed`）嵌套的 `data.response.usage` 里。已扩展该函数同时兼容两种 envelope：cached token 字段名两个都读一遍；用 `data.response` 是否存在且为对象、并带 `usage` 字段来判断要不要下钻读取，不逐一枚举具体事件名字符串。**关键正确性细节**：判断条件必须包含 `typeof nested === 'object'`——部分 workers-ai 模型原生返回 `{ response: "纯文本字符串", usage }`，`.response` 是字符串而非对象，这个类型判断能让代码正确回退读顶层 `data.usage`，不会误判成 Responses API 的嵌套结构，这是让同一个函数能被 chat completions / images / xiaomi-mimo / workers-ai / responses 五个调用方安全共用的必要条件。不新增 `ProviderKey`/billingProvider 字符串，统一复用 `'openai'` 分支。`output_tokens_details.reasoning_tokens` 不需要特殊处理——已经是 `output_tokens` 的子集（breakdown 展示用），不额外累加。

**已知限制（v1）**：不支持 `background: true` 轮询 / `GET` 检索 / 取消（Codex 交互式流式场景不需要）；所有网关用户共享同一上游 OpenAI 账号（AI Gateway Stored Keys），`previous_response_id` 未做租户级加密隔离——这是本项目现有共享凭证模型的既有属性，不是这次改动引入的新风险。

### 只有 Claude 走 Unified Billing / BYOK（防误烧 credits）+ BYOK 开关

**背景**：其它 provider 的 key 容易获得（OpenAI/Gemini 走 Gateway Stored Keys 自付、MiMo 直连自有 key），只有 Claude 因账号门槛走 CF 代付。Unified Billing 有 5% 充值费与 200 req/min/网关 限速，必须严格限定只有 Claude 用。

**决策**：
- `gateway-service.ts` 的代付凭证注入改为**显式 allow-list** `UNIFIED_BILLING_PROVIDERS = {anthropic}`（取代原来的反向 deny-list `SELF_PAID_PROVIDERS`）。默认「未知 provider → 自付」，杜绝将来新增 provider 忘记排除而静默落入代付烧 credits。单测断言 openai/google-ai-studio/workers-ai 均不被注入代付凭证。
- **BYOK 开关** `ANTHROPIC_CREDENTIAL_MODE`（`unified` / `byok`）：byok 时原生路注入 `x-api-key`、compat 路注入 `Authorization: Bearer ANTHROPIC_API_KEY`，且**绝不带** `Authorization: Bearer CF_TOKEN`（带了会触发代付 / 被 compat 当成 key 报 401）。
- **计费经济性**：Claude `markupRate` = 1.05（2026-07-08 起，从 1.1 下调），byok 下不再产生 CF Unified Billing 的 5% 充值费，只需覆盖 Stripe 手续费。
- **2026-07-08：全量切到 byok，代码层验证通过**。此前"作者自有 Anthropic 组织被禁用"的限制已解除。用 `scripts/smoke-claude-unified.ts` 的 Leg C（byok 原生透传）+ 新增的 Leg D（byok OpenAI 兼容）分别用真实 `ANTHROPIC_API_KEY` 验证两条路径均 200、usage 字段正常，才把生产 `ANTHROPIC_CREDENTIAL_MODE` 从缺省的 `unified` 改成显式 `byok`（`wrangler.jsonc` `vars`）。
- **踩过的坑：CF AI Gateway 后台的 Stored Key 会绕过代码层开关**。排查这次切换时发现，`api-router` 网关的 `anthropic` provider 早就在 CF 后台配置了一个 Stored Key（推测是更早排查"组织被禁用"时留下的），这个设置完全不受版本控制、代码里也查不到——即使代码从未设过 `ANTHROPIC_CREDENTIAL_MODE=byok`（缺省 `unified`，`/v1/messages` 会显式发 `Authorization: Bearer CF_TOKEN`），CF Gateway 仍然优先用 Stored Key 打上游，实际效果是请求早就在用自己的 Anthropic 账号出钱、Unified Billing credits 完全没扣——直到今天对着 Anthropic Console 和 CF Gateway credits 两边对账才发现。**教训**：CF Gateway 后台的 Provider Keys 配置是脱离代码库的隐藏状态，会让"代码里写的模式"和"实际生效的模式"悄悄脱节；本次显式把 `ANTHROPIC_CREDENTIAL_MODE=byok` 写回 `wrangler.jsonc`，就是让这个 Stored Key 万一被误删/轮换时，代码层还有一层不依赖 CF 后台点击操作的保险丝。

### xAI Grok 接入（/v1/chat/completions、/v1/images/generations）

**背景**：Cloudflare AI Gateway 于 2026-06-04 起原生支持 xAI Grok（`grok` 是网关 provider slug）。聊天补全接口与 OpenAI Chat Completions 兼容，图片生成接口路径、鉴权方式与 OpenAI Images API 一致（`POST /v1/images/generations`）。

**决策**：不复用 `GatewayService.proxyNative()`（该类的代付凭证注入是为 Anthropic 的 unified/byok 双模式 allow-list 设计的），而是在 `provider-dispatch.ts` 新增独立的 `callGrokEndpoint()`，chat 和 images 两个端点共用同一个函数（镜像 `callOpenAIEndpoint` 的"共享 path 参数"写法）。网关路径保留 `/v1` 前缀（`.../grok/v1/chat/completions`），与 `openAIGatewayBase()` 的路径约定（不带 `/v1`）不同，已用官方文档核实。

**凭证**：xAI key 以 Stored Keys 形式配置在 CF AI Gateway 后台（`api-router` 网关的 `grok` provider），本服务不持有真实 xAI key，`callGrokEndpoint()` 只带 `cf-aig-authorization` 网关凭证、不注入 `Authorization`——与 `proxyNative()` 里 openai/google-ai-studio（非 `UNIFIED_BILLING_PROVIDERS` allow-list 内的 provider）的凭证模式一致。[CF 官方文档](https://developers.cloudflare.com/ai-gateway/usage/providers/grok/)展示的调用示例是调用方自带 `Authorization: Bearer {xai_api_token}`、未提及 Stored Keys，但 Stored Keys 是 AI Gateway 的通用能力，本项目网关后台已配置生效，故沿用零凭证注入的写法而非 BYOK。

**图片计费换算**：xAI 图片响应会返回 `usage.cost_in_usd_ticks`，换算率是 `1 USD = 10^10 ticks`。两个图片模型统一配置为 `inputPrice=0`、`outputPrice=1`（即 `$1/1M` 内部 tokens），`extractGrokImageUsage()` 用 `ticks / 10,000` 得到内部 output token，再复用现有 markup、免费额度、钱包与 usage log 链路。若上游异常缺少 ticks，则按共享的官方价格配置、参考图数量、输出数量和分辨率算美元成本，再乘 `1,000,000` 得到内部 token；不要重新引入按张计费 schema。

**图片模型与协议**：支持 `grok-imagine-image`（参考图 `$0.002/张`、输出 `$0.02/张`）和 `grok-imagine-image-quality`（参考图 `$0.01/张`、1K 输出 `$0.05/张`、2K 输出 `$0.07/张`）。生成端点支持 `n`、`aspect_ratio`、`resolution`、`response_format`；编辑端点要求 `application/json`，单图使用 `image`、2–3 张使用 `images`，不能复用 OpenAI SDK 的 multipart 编辑协议。模型能力和价格集中在 `@muirouter/shared-db/grok-image`，后端和 Playground 必须共用。`markupRate` 统一为 1.05。

**范围**：本轮仅接入文本对话模型（`grok-4.3`/`grok-4.5`）+ 图片生成。视频生成（`grok-imagine-video`）是异步任务模型（提交请求拿 `request_id`，轮询 `GET /v1/videos/{request_id}` 直到 `status: done`），需要一套新的任务状态追踪子系统（记录谁提交了哪个 job、避免轮询到 done 时重复扣费），与现有「单次请求单次响应」的同步代理架构不兼容，体量远超接入一个 provider 本身，拆成独立后续任务（见 GitHub issue），本轮未接入。`/providers/grok/*` 原生透传路由（`gateway-service.ts` / `routes/providers.ts` 的 `SUPPORTED_PROVIDERS`）同样未接入，仅通过 `/v1/chat/completions`、`/v1/images/generations` 两个既有端点分发，接入深度与 Gemini/MiMo 一致；如需裸透传，只需给这两个 Set 加一行。

### Grok 异步视频生成（/v1/videos/generations、/v1/videos/:requestId）

**任务归属与协议**：视频 generation 使用独立的 `video_generation_jobs` 表，以 xAI `request_id` 为主键，保存用户/API Key、模型参数、预占 ID、费率快照和终态结算结果。查询必须同时匹配 `request_id + user_id`，不存在和越权统一返回 404。当前只支持 generation：`grok-imagine-video` 可文生视频或单图生视频，`grok-imagine-video-1.5` 必须带单图；不代理 reference/edit/extension。

**预占后结算**：视频不使用免费额度。提交前按 duration、resolution、输入图成本、模型 markup 和用户费率倍率计算最高授权金额，`WalletDO` 以 reservation ID 原子预占可用余额，但不提前扣款。`pending` 查询把预占有效期续到 24 小时；`failed/expired` 幂等释放；`done` 优先按 `usage.cost_in_usd_ticks` 计算实际费用，缺失时使用提交估算，低于预占则只扣实际值，高于预占则以授权金额封顶。

**幂等边界**：钱包 reservation 记录负责并发结算去重，`usage_logs.id = video:{request_id}` 负责审计日志去重，任务表的 `billed_at` 负责快速跳过已完成结算。顺序是钱包结算、确定性 usage log、任务 billed 标记；任何一步失败都可由下次轮询安全重试。视频链接保持 xAI 临时 URL，不在本服务转存。

### AWS Bedrock 直连方案：已设计，暂时搁置

**背景**：2026-07-08 曾计划把 `claude-opus-4-6`/`claude-sonnet-4-6`/`claude-haiku-4-5`（"4.6 及之前"）直连 AWS Bedrock（账号已获这几个模型的访问权限），更高级的模型（`opus-4-7`/`opus-4-8`/`sonnet-5`）切 CF AI Gateway BYOK。调研到细节：AWS Bedrock 不支持 Claude 的 OpenAI Chat Completions 协议（只能走 Messages/Invoke/Converse）；`claude-haiku-4-5` 能走新的 `bedrock-mantle` 端点（纯 Bearer token 鉴权，`POST https://bedrock-mantle.{region}.api.aws/anthropic/v1/messages`）；`claude-opus-4-6`/`claude-sonnet-4-6` 只能走老的 `bedrock-runtime`（`POST .../model/{us.anthropic.claude-...}/invoke`，模型 ID 需要 `us.` cross-region 前缀，鉴权是纯 Bearer 还是要上 AWS SigV4 未有定论，流式响应是 AWS 专有二进制 eventstream 格式，非 SSE）。

**搁置原因**：当天 AWS Bedrock 账号本身访问不稳定（原因未明），且已发现 CF AI Gateway 后台的 Stored Key 让 byok 实际上早就在生效（见上方"只有 Claude 走 Unified Billing / BYOK"一节），能达成同样的省钱目标（绕开 CF 5% 充值费），不需要再额外接入一个尚不稳定、鉴权细节也没完全钉死的新上游。`AWS_BEDROCK_API_KEY` secret 仍然部署在生产（未被代码引用），`bedrock-mantle`/`bedrock-runtime` 拆分方案设计留档于此，以后 Bedrock 稳定或需要绕开 Anthropic 账号限额时可以直接捡回来实现，不需要重新调研端点/鉴权细节。

### Claude Sonnet 5 限时定价

**决策**：`claude-sonnet-5` 种子数据按 Anthropic 发布时的限时价 $2/$10（input/output，`anthropicCache(2)` → cache read $0.2、write $2.5）录入，markup 1.05，与其它 Claude 型号一致。

**原因**：Anthropic 官方公告明确该价格仅到 **2026-08-31**，2026-09-01 起涨回标准价 $3/$15（与 `claude-sonnet-4-6` 同价）。

**待办**：2026-09-01 前后需要把 `packages/app/src/db/seed.ts` 里 `claude-sonnet-5` 的 `inputPrice`/`outputPrice` 改为 `3`/`15`、`anthropicCache(2)` 改为 `anthropicCache(3)`，重新生成 SQL 并应用到远程 D1，否则会一直按限时价对外结算，实际成本超过收费。

### Xiaomi MiMo 定价记录

**决策**：种子数据中 `xiaomi-mimo` 文本/多模态模型定价使用官方海外价格的 cache miss、`Input ≤ 256K` 档位；TTS 系列当前官方标记为限时免费，因此暂记为 `0 / 0`。

**原因**：
- `models` 表现已支持 cache 命中价与长上下文分档（见「计费定价矩阵」），但仍无法表达夜间折扣等时间相关定价
- 选择 cache miss 基础档位能避免缓存命中假设带来的低估
- `mimo-v2.5-pro` / `mimo-v2-pro` 在 256K-1M 输入区间存在更高档位，如果长上下文使用量明显增加，需要把模型计价扩展为上下文分段计费
- `mimo-v2.5-tts`、`mimo-v2.5-tts-voiceclone`、`mimo-v2.5-tts-voicedesign`、`mimo-v2-tts` 的免费状态不是长期价格承诺，需要在官方结束免费后同步更新生产库模型价格

### Route Handler（route.tsx）不会自动继承祖先 layout 的 generateStaticParams

**背景**：`og-image/route.tsx` 长期被 Next.js 当作全动态路由处理，即使 `[locale]/layout.tsx` 早已声明了 `generateStaticParams()`。根因是 Next.js 内部按文件类型走两条不同的静态参数收集路径：`page.tsx` 用 `collectAppPageSegments`，会遍历整条 loader 树，因此自动拿到祖先 layout 声明的 `generateStaticParams`；`route.tsx` 用 `collectAppRouteSegments`，只读取路由文件自身的导出，不继承任何祖先声明。结果是所有 `[locale]/.../route.tsx` 只要没有自己单独声明 `generateStaticParams`，就会一直是动态路由，每次请求都现算、不进静态缓存——这条路由曾因此导致 og:image 抓取超时（Twitter/Facebook 卡片完全不带图，2.9~6.5s 无缓存响应，修复后降到几毫秒）。

**结论**：任何新增的 `[locale]/**/route.tsx` 如果希望走静态生成（尤其是 `next/og` 这类计算成本高的响应），必须在文件里单独写一份 `generateStaticParams`（通常就是 `routing.locales.map((locale) => ({ locale }))`），不能指望祖先 layout 的声明会生效；同时建议加 `export const dynamic = 'force-static'` 让意图显式化。

### Phosphor 图标在 Server Component 里必须从 `/ssr` 子路径导入

**背景**：2026-07-18 把图标库从 lucide-react 迁移到 Phosphor 时，`next build` 在 8 个营销页 Server Component（无 `use client`）和 `components/ui/spinner.tsx` 上报 `TypeError: (0 , b.createContext) is not a function`，构建直接失败。lucide-react 的图标是无状态的纯 SVG 包装组件，在 Server/Client Component 里导入方式完全一样，之前从未遇到过这类问题；Phosphor 默认导出（`@phosphor-icons/react`）内部依赖 `IconContext`（`React.createContext`）做 weight/color/size 的上下文继承，这个实现只能在 Client Component 的 React 运行时里工作，Server Component 渲染时找不到对应的 `createContext` 实现就会在模块求值阶段直接抛错。

**结论**：Phosphor 官方为此提供了单独的 SSR 版本，图标名完全一致，只是包路径不同——**没有 `'use client'` 的文件**（Server Component）必须从 `@phosphor-icons/react/ssr` 导入图标，**有 `'use client'` 的文件**（Client Component）继续从 `@phosphor-icons/react` 导入。新增用到图标的文件时，先看这个文件是不是 Server Component，选错路径本地 `next dev` 不一定会立刻报错，要跑一次 `next build` 才会在"Collecting page data"阶段暴露。

### 多语言与国际化 (i18n)

**决策**：Dashboard 全面采用 `next-intl` 提供多语言支持。

**要点**：
- 支持包括中文、英文在内的 8 种语言。
- 语言配置文件和翻译文本由 `next-intl` 标准结构维护。
- SEO 适配多语言，`sitemap.xml` 和 `robots.txt`、JSON-LD 都考虑了多语言版本的动态生成。

### 博客 metadata 放 D1，正文保留 MDX

**决策**：博客文章正文继续放在 `packages/dashboard/src/content/blog/*.mdx`，标题、描述、发布日期、阅读时间、tags、sources 等 metadata 放 D1 的 `blog_posts` / `blog_post_translations`。文章页和 OG 图统一走 `/blog/[slug]` 动态路由，不再为每篇文章新增单独 route 文件，也不再维护代码内 `BLOG_POSTS` 常量。

**原因**：
- 新增文章时只需要提交 MDX 正文并写入 D1 metadata，减少重复改 `blog.ts`、文章页、OG route 的维护成本。
- 正文仍进 Git，保留 review、回滚、构建期 MDX 校验能力，不引入富文本安全、图片上传、编辑器等 CMS 复杂度。
- metadata 是运行时数据，`/blog`、`/blog/[slug]`、`/sitemap.xml`、OG 图都会查询 D1；当前文章量很小，暂不做持久缓存。访问量上来后再加 5-10 分钟缓存。

**发文流程**：
1. 添加 `content/blog/{slug}.mdx`，需要中文时添加 `{slug}.zh.mdx`。
2. 向 `blog_posts` 写入 slug、发布日期、阅读时间、状态等。
3. 向 `blog_post_translations` 写入各语言 title / description / tags_json / sources_json。
4. 不再新增单篇 `page.tsx` / `og-image/route.tsx`。

### SEO 重定位与品牌拼写（消解 Material UI 歧义）

**背景**：GSC 显示 muirouter.com 曝光被 Material UI / MUI X 意图主导（`mui pricing`、`muix pricing`、`mui pro`），真正的 `ai router` 只排到 pos 47-87，CTR 0.66%。

**决策**：
- 品牌统一拼写为 **`MuiRouter`（一个词）**，不再用 `MUI Router`（空格 + 大写 MUI）。后者让每个页面标题带上独立的 `MUI` token，是 Material UI 曝光的头号来源；一个词且与域名一致，仍能命中 `mui router` 品牌词。改名覆盖 `lib/seo.ts` `SITE_NAME`、根 layout `title.template`、OG 图、JSON-LD、邮件等。
- 文案/metadata 显式打出 `AI API Router / LLM Router / OpenAI-compatible / MCP server` 意图词，并**按语种本地化关键词**（de→KI、es/pt→IA + 保留 "router"、zh→AI 路由、ja→AI ルーター），不要机械直译。
- 主题集群（pillar-spoke）：支柱页 `/ai-router` + 分簇页 `/llm-router`、`/openai-compatible-router`、`/mcp-router`，共用 `(marketing)/_components/router-landing.tsx`（内容全走 i18n namespace，8 语言；内联 FAQPage / BreadcrumbList 结构化数据）。新页 canonical/hreflang 由 `buildMetadata` 自动产出，sitemap 仅需在 `pages[]` 增条目并 bump `STATIC_PAGES_UPDATED_AT`。
- 营销文案不再硬编码：`/mcp` 页此前对全部语言硬编码中文，已抽到 `mcpPage` namespace 并补齐 8 语言（代码块/endpoint/curl 保持字面，动态值用 ICU 占位符 `{url}`/`{header}`/`{path}`）。

**度量**：上线后 28 天窗口在 GSC 看 `ai router`/`router ai` 排名上行、Material UI 式曝光下降、承载页 CTR 上升（按 `dimensions=query,page` 排查蚕食）。

### IndexNow 手动提交脚本（Bing 重新发现，issue #4）

**背景**：Bing Webmaster 显示 muirouter.com 曝光极低，Bing Sitemaps 只发现 3 个 URL、最后抓取停留在很久之前，而实际 sitemap 早已扩展为多语言全量 URL（见上一节）。Bing 官方建议里包含"Set up IndexNow"——一个由 Bing/Yandex/Seznam/Naver 等共同支持的协议，站点主动推送 URL 而不是等搜索引擎自然重新抓取。

**决策**：
- Key 文件 `packages/dashboard/public/{key}.txt` 直接把 key 当作可公开访问的静态文件提交，**不当作 secret/env var 处理**——IndexNow 协议的验证机制本身就要求 key 文件公开可访问，加密/隐藏它没有安全收益，只会增加不必要的部署配置。`public/` 下的文件由 OpenNext 原样打包进 `.open-next/assets`，部署后由 Cloudflare Workers 在站点根路径直接提供服务，不需要额外路由。
- 提交端点选用通用的 `https://api.indexnow.org/indexnow` 而非 Bing 专属端点：提交一次即可同时通知所有参与该协议的搜索引擎。
- 只做**手动脚本**（`pnpm --dir packages/dashboard run submit:indexnow -- --dry-run`），不接入 GitHub Actions 定时任务或 Cloudflare Worker cron——仓库目前没有任何 schedule 类型的自动化先例，而这次的直接需求只是"推动一次重新发现"，人工控制发布节奏足够；`scripts/indexnow.ts` 已经把 URL 提取逻辑拆成纯函数，后续如果要接自动化触发点很容易。
- `submit-indexnow.ts` 从线上 `sitemap.xml` 现抓 URL（而不是在构建期直接调用 `sitemap()` 函数），因为后者依赖 D1/`getPublishedBlogSitemapPosts()` 等 Next.js runtime 上下文，脚本用纯 node 执行没有这个上下文。

**踩过的坑：`packages/dashboard/tsconfig.json` 缺少 `allowImportingTsExtensions`**。Node 24 原生执行 `.ts` 文件不解析 tsconfig 的 `@/*` 路径别名，只支持标准 ESM 相对路径且必须带显式 `.ts` 扩展名（如 `import { x } from './indexnow.ts'`）——这是 `packages/app/scripts/print-seed-sql.ts` 早就验证过的写法。但 dashboard 的 `tsconfig.json` `include` 是 `**/*.ts`，会把 `scripts/` 下的新文件也纳入 typecheck，而 TypeScript 默认不允许 import 路径带 `.ts` 扩展名（`TS5097`）。修复：给 `compilerOptions` 加 `"allowImportingTsExtensions": true`（前提 `noEmit`/`emitDeclarationOnly` 二选一为 true，本项目已满足）。**后续任何人在 `packages/dashboard` 下新增"要被纯 node 执行的脚本"，都会撞到同一个坑**，且 CI 目前不跑 `pnpm run typecheck`（见 TESTING.md），这个坑不会被 CI 挡住，只会在本地手动 typecheck 时暴露。

**顺手修复的 CI bug**：`.github/workflows/ci.yml` 的 `dashboard-e2e` job 一直用 `pnpm --filter dashboard`，但 `packages/dashboard/package.json` 的真实包名是 `mui-api-dashboard`——这个过滤器自建库以来从未匹配到任何包，`pnpm --filter dashboard ...` 会静默跳过并以 exit code 0 退出，导致 `dashboard-e2e` job 从未真正执行过 `packages/dashboard/e2e/` 下的任何用例（包括早就存在的 `seo.test.ts`/`auth.test.ts`/`dashboard.test.ts`/`marketing.test.ts`），但 CI 一直显示绿色。已改为 `pnpm --filter mui-api-dashboard`。**这个修复本身会让该 job 从"从未真正跑过"变成"第一次真正执行"，如果既有用例里有跟这次改动无关的失败，会在这次改动之后第一次暴露出来**，需要单独排查，不代表是这次改动引入的回归。

**测试与执行环境约束**：`packages/dashboard/scripts/indexnow.ts` 是零 `@/` 别名依赖的纯函数模块（`SITE_URL` 直接硬编码，不 import `src/lib/seo.ts`，与 `robots.ts` 硬编码 sitemap URL 是同样的取舍），既能被 `submit-indexnow.ts` 用纯 node 执行，也能被 vitest 直接 import 测试；`vitest.config.ts` 的 `test.include` 因此扩展为同时覆盖 `src/**/*.test.ts` 和 `scripts/**/*.test.ts`。

### better-auth 统一用户体系

**决策**：Dashboard 使用 better-auth 管理用户认证，`user` 表同时作为业务用户表。

**要点**：
- `getAuth()` 需要异步获取 Cloudflare context 来访问 D1 binding
- 启用了 email/password 认证（最小密码长度 8）
- Cookie 通过 `nextCookies()` 插件管理
- App 端通过 API Key hash 认证，与 better-auth 无关

### Stripe 充值使用 Checkout + webhook 幂等入账

**决策**：用户自助充值采用 Stripe Checkout Session，一次性支付固定档位 `$10 / $20 / $50`，到账以 webhook 为准，不依赖前端回跳。

**原因**：
- Stripe Checkout 适合固定金额的一次性支付，落地快，减少自行处理支付表单和 SCA 的复杂度
- 回跳页不可靠，用户可能关闭页面或使用异步支付方式，必须以 webhook 作为最终入账触发点
- 通过 `recharge_logs(source, source_id)` 唯一标识和 `stripe_topup_sessions` 状态表做幂等，可以避免重复加余额
- 复用 KV 中的 `stripeCustomerId`，能保留 Stripe Customer 关联，减少重复建档

### 用量统计增加用户维度、新增用户详情页

**决策**：新增 `/admin/users/[userId]` 详情页，聚合展示指定用户的信息卡、充值记录、用量记录、按天用量统计（趋势图 + 明细表），并从用户管理、用量统计、统计分析三处提供跳转入口；`RechargeLogTable` / `UsageLogTable` / `lib/date-ranges.ts` 抽出供多处复用。充值/用量列表页同时支持 URL 参数 `userId` 预填筛选，配合详情页"查看全部"链接跳转定位。

**顺带修复的两个 bug（因无 UI 调用、一直未被发现）**：
- `GET /api/admin/user` 缺失 `rateMultiplier` 字段
- `GET /api/admin/statistics` 按 `userId` 筛选聚合数据时，模型分布未生效过滤条件

**教训**：这两个 bug 能存在这么久，是因为在这次新增详情页之前，`stats-aggregation-core.ts` 里已有的按用户维度聚合能力（`e2e/cron-aggregation.test.ts` 早就验证过聚合结果本身正确）从未真正接了前端 UI，契约层的字段缺失和过滤条件错误没有任何调用方能触发。2026-07-18 维护轮次为 `admin/users/[userId]` 补了组件测试 + 一条登录态 e2e（覆盖渲染与真实 D1 契约），就是为了避免同类"数据正确但契约层没人验证"的问题再次潜伏。

## 关键模式

### Claim Token（一次性密钥查看）

支付成功后生成 claim token（15 分钟有效），用户通过链接领取 API Key。明文 key 存储在 D1 的 `tempRawKey` 字段，领取后立即清空。避免密钥在邮件中长期暴露。

### 并发控制

- 权威状态在 `ConcurrencyLimiterDO`，按 `userId` 管理 lease
- 默认 lease TTL 为 90 秒，每 30 秒心跳续租
- `user:{userId}.concurrency` 仅为 dashboard 展示镜像，不参与准入判断
- lease 在 response body 的 EOF / cancel / error 时释放，而不是在 middleware `finally` 中提前释放

### 花费限额与告警

- 全局告警：超过每日/每月上限时暂停整个服务
- 用户告警：24 小时冷却期防止重复通知
- 自动暂停：同时更新 KV 和 D1 状态

### API Key 有效但用户数据缺失

API Key 验证通过但 KV 中无用户数据时，自动初始化（余额=0），返回 402 而非 401。避免数据不一致导致误判为未授权。

## 环境配置

### 必需的 Secrets

**具体清单以 [DEPLOYMENT.md](./DEPLOYMENT.md) 为单一权威来源**（含必需/可选划分、默认值、配置命令），不在此处重复维护第二份清单——两份独立清单曾经出现过其中一份漏更新新增 provider 的情况（见下方「SEO 重定位」一节 README 漏加 Grok 的同类教训）。

这里只记录清单本身解释不到的决策性说明：
- `CF_TOKEN` 只在 Claude Unified Billing（原生 `/v1/messages` 透传）代付时使用，`byok` 模式下不应再配置，否则会被当作 Anthropic key 触发 401（见上方「只有 Claude 走 Unified Billing / BYOK」一节）。
- `MOONSHOT_API_KEY` / `MIMO_API_KEY` 对应的请求都不经过 CF AI Gateway，因此不会出现在 Gateway 日志里，排查问题时不要去 Gateway 后台找。

### Cloudflare Bindings

两个 package 共享同一个 D1 数据库和 KV namespace。wrangler.jsonc 中的 binding name 必须保持一致。

共享 D1 的 schema、migration 和迁移脚本统一由 `packages/shared-db` 维护。`packages/app` 和 `packages/dashboard` 只保留各自的运行时 binding，避免多个子项目各自产生一份 SQL 历史或各自维护迁移入口。

本地开发时，`packages/shared-db db:migrate:local`、`packages/app dev` 与 `packages/dashboard dev` 都应指向仓库根目录下同一份 `.wrangler/state/v3`。同时显式关闭 remote bindings，避免本地代码误连远程 D1 / KV，导致“看起来在本地调试，实际上在修改远程数据”。
