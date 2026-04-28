# 开发笔记

记录架构决策、技术选型依据、以及开发过程中积累的非显而易见的知识。

## 架构决策

### CF AI Gateway Stored Keys 认证

**决策**：不在本服务中存储各 AI Provider 的 API Key，而是通过 CF AI Gateway 的 Stored Keys 功能统一管理。

**原因**：
- 集中化凭证管理，Provider Key 不暴露在代码或环境变量中
- 本服务只需一个 `CF_AIG_TOKEN`，由 CF Gateway 负责路由到正确的 Provider
- 支持两种代理模式：`compat`（OpenAI 兼容）和 `native`（Provider 原生端点）
- 认证头使用 `cf-aig-authorization: Bearer {CF_AIG_TOKEN}`

### KV + D1 + Durable Object 分层存储

**决策**：用户配置和展示镜像放 KV，并发准入放 Durable Object，持久化/可查询数据放 D1。

| 存储 | 用途 | 原因 |
|------|------|------|
| KV | 用户余额、API Key hash 验证、并发展示镜像、花费统计 | 每次请求都要读，需要亚 60ms 延迟 |
| Durable Object | 每用户活跃 lease、并发准入、过期清理 | 同一用户状态天然串行，避免 KV 读改写竞争 |
| D1 | 用户账户、使用日志、模型定价、花费限额、better-auth 表 | 需要 SQL 查询、聚合、关联 |

**KV Key 命名约定**：
- `user:{userId}` — 用户数据（余额、并发等）
- `apikey:{keyHash}` — API Key 到 userId 的映射
- `config:global` — 全局配置（每日/每月花费上限、服务暂停标志）
- `stats:daily:{date}` / `stats:monthly:{month}` — 全局花费统计（带 TTL）
- `spending:user:{userId}:{month}` — 用户月度花费（TTL 35 天）

### 异步计费（waitUntil）

**决策**：计费在响应返回后异步执行，不阻塞 API 响应。

**实现**：
- 非流式：从 JSON response body 提取 usage
- 流式：用 `tee()` 分流 body，一份给客户端，一份给计费处理器
- 通过 `c.executionCtx.waitUntil()` 执行计费管道：计算费用 → KV 扣余额 → D1 记日志 → 告警检查

**注意**：计费崩溃不影响已发送的响应。需要依赖告警系统发现计费异常。

### 图片模型计费粒度

**现状**：`models` 表目前只有一组 `inputPrice` / `outputPrice`，但 OpenAI 图片模型可能区分文本输入 token 与图片输入 token 的单价。

**当前决策**：`gpt-image-2` 种子数据使用图片输入价作为 `inputPrice`，避免编辑图片时低估成本；纯文本生成场景会略高估输入成本，但图片输出通常占主要成本。

**后续优化**：如果图片调用量增加，需要把模型定价扩展为按 token 类型计费，例如 text input、image input、cached input、output 分列。

### AI Provider 路由分发 (Gateway vs. env.AI)

**决策**：根据不同 Provider 的特性采取不同的调用方式，不再一刀切地全部走 AI Gateway Stored Keys。

**实现**：
- **OpenAI / Google AI Studio**：继续走 CF AI Gateway，由其 Stored Keys 注入真实的 API Key。
- **Xiaomi MiMo**：不走 CF AI Gateway，直接用 `MIMO_API_KEY` 请求 OpenAI 兼容接口，默认 base URL 为 `https://api.xiaomimimo.com/v1`，可通过 `MIMO_BASE_URL` 覆盖。Provider 标识为 `xiaomi-mimo`，计费 usage 按 OpenAI 兼容响应解析。
- **Anthropic / Workers AI (等免 Key 渠道)**：不再维护它们在 Gateway 中的 Key 映射，而是直接走 `env.AI.run`（利用 Workers AI 的原生 binding 及内置兼容端点）。这允许项目无缝调用 `claude-3-5-sonnet-latest` 和 `@cf/meta/llama-3.1-8b-instruct` 而不需要自己付费买 Key，只需为 Workers AI 使用量计费。通过配置 `gateway: { id: env.CF_GATEWAY_ID }`，依然可以保留对这些请求的 Gateway 监控面板统计。

### Xiaomi MiMo 定价记录

**决策**：种子数据中 `xiaomi-mimo` 文本/多模态模型定价使用官方海外价格的 cache miss、`Input ≤ 256K` 档位；TTS 系列当前官方标记为限时免费，因此暂记为 `0 / 0`。

**原因**：
- 当前 `models` 表只有一组 `inputPrice` / `outputPrice`，不能表达 cache hit、长上下文分档或夜间折扣
- 选择 cache miss 基础档位能避免缓存命中假设带来的低估
- `mimo-v2.5-pro` / `mimo-v2-pro` 在 256K-1M 输入区间存在更高档位，如果长上下文使用量明显增加，需要把模型计价扩展为上下文分段计费
- `mimo-v2.5-tts`、`mimo-v2.5-tts-voiceclone`、`mimo-v2.5-tts-voicedesign`、`mimo-v2-tts` 的免费状态不是长期价格承诺，需要在官方结束免费后同步更新生产库模型价格

### 多语言与国际化 (i18n)

**决策**：Dashboard 全面采用 `next-intl` 提供多语言支持。

**要点**：
- 支持包括中文、英文在内的 8 种语言。
- 语言配置文件和翻译文本由 `next-intl` 标准结构维护。
- SEO 适配多语言，`sitemap.xml` 和 `robots.txt`、JSON-LD 都考虑了多语言版本的动态生成。

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

**App (packages/app)**：
- `CF_AIG_TOKEN` — CF AI Gateway 认证 token
- `MIMO_API_KEY` — Xiaomi MiMo API Key，仅启用 `xiaomi-mimo` 模型时需要
- `ADMIN_SECRET` — 管理接口认证
- `ADMIN_EMAIL` — 告警接收邮箱
- `RESEND_API_KEY` — 邮件发送（可选，未配置则跳过）
- `BASE_URL` — 服务基础 URL
- `FROM_EMAIL` — 发件人地址

**Dashboard (packages/dashboard)**：
- `BETTER_AUTH_SECRET` — 认证密钥
- `RESEND_API_KEY` — 邮件发送
- `FROM_EMAIL` — 发件人地址
- `STRIPE_SECRET_KEY` — Stripe 服务端密钥
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook 签名密钥

### Cloudflare Bindings

两个 package 共享同一个 D1 数据库和 KV namespace。wrangler.jsonc 中的 binding name 必须保持一致。

共享 D1 的 schema、migration 和迁移脚本统一由 `packages/shared-db` 维护。`packages/app` 和 `packages/dashboard` 只保留各自的运行时 binding，避免多个子项目各自产生一份 SQL 历史或各自维护迁移入口。

本地开发时，`packages/shared-db db:migrate:local`、`packages/app dev` 与 `packages/dashboard dev` 都应指向仓库根目录下同一份 `.wrangler/state/v3`。同时显式关闭 remote bindings，避免本地代码误连远程 D1 / KV，导致“看起来在本地调试，实际上在修改远程数据”。
