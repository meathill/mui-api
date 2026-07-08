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
- **Xiaomi MiMo**：不走 CF AI Gateway，直接用 `MIMO_API_KEY` 请求 OpenAI 兼容接口，默认 base URL 为 `https://api.xiaomimimo.com/v1`，可通过 `MIMO_BASE_URL` 覆盖。Provider 标识为 `xiaomi-mimo`，计费 usage 按 OpenAI 兼容响应解析。
- **Anthropic (Claude)**：经 CF AI Gateway 的 **Unified Billing** 由 Cloudflare 代付（充值 CF credits，无需自有 Anthropic 账号）。两条对外面：原生 `/v1/messages` 走 provider-native 透传（`proxyNative`，`cf-aig-authorization` + `Authorization: Bearer CF_TOKEN`，返回 Anthropic 原生 usage）；OpenAI 兼容 `/v1/chat/completions` 走 compat 端点（`callAnthropicCompat`，**仅** `cf-aig-authorization`，model 带 `anthropic/` 前缀，返回 OpenAI 形 usage）。upstreamModelId 用 Anthropic 规范连字符 ID（如 `claude-haiku-4-5`）。
  - **入站认证兼容 `x-api-key`**：Anthropic 官方 SDK / Claude Code 默认用 `x-api-key` 头而非 `Authorization: Bearer` 发送凭证，`authMiddleware` 两种头都接受（`middleware/auth.ts`），否则原生 SDK 直连会全部 401。
  - **早期误区订正**：曾以为 Claude 可走 `env.AI.run`（Workers AI binding）「免 Key、按 Workers AI 计费」——这是错的：Workers AI 不托管 Claude，且 Workers AI 模型走 Gateway 也不计入 Unified Billing。Claude 必须走 Unified Billing 代付。
- **Workers AI (`@cf/*`)**：走 `env.AI.run` + `gateway: { id }`，按 Workers AI 用量（neuron）计费，保留 Gateway 监控。

### 只有 Claude 走 Unified Billing（防误烧 credits）+ BYOK 开关

**背景**：其它 provider 的 key 容易获得（OpenAI/Gemini 走 Gateway Stored Keys 自付、MiMo 直连自有 key），只有 Claude 因账号门槛走 CF 代付。Unified Billing 有 5% 充值费与 200 req/min/网关 限速，必须严格限定只有 Claude 用。

**决策**：
- `gateway-service.ts` 的代付凭证注入改为**显式 allow-list** `UNIFIED_BILLING_PROVIDERS = {anthropic}`（取代原来的反向 deny-list `SELF_PAID_PROVIDERS`）。默认「未知 provider → 自付」，杜绝将来新增 provider 忘记排除而静默落入代付烧 credits。单测断言 openai/google-ai-studio/workers-ai 均不被注入代付凭证。
- **BYOK 开关** `ANTHROPIC_CREDENTIAL_MODE`（`unified` 默认 / `byok`）：byok 时原生路注入 `x-api-key`、compat 路注入 `Authorization: Bearer ANTHROPIC_API_KEY`，且**绝不带** `Authorization: Bearer CF_TOKEN`（带了会触发代付 / 被 compat 当成 key 报 401）。
- **计费经济性**：Claude `markupRate` = 1.1，覆盖 CF 5% 充值费 + Stripe 手续费，不赚不亏（本服务为私域开发者辅助工具，不以盈利为目的）。
- **现状提醒**：作者自有 Anthropic 组织当前被禁用（`This organization has been disabled`），故 BYOK 暂不可用、未实测；unified 主线不受影响。

### Claude Sonnet 5 限时定价

**决策**：`claude-sonnet-5` 种子数据按 Anthropic 发布时的限时价 $2/$10（input/output，`anthropicCache(2)` → cache read $0.2、write $2.5）录入，markup 1.1，与其它 Claude 型号一致。

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
- `CF_AIG_TOKEN` — CF AI Gateway 网关认证 token（cf-aig-authorization）
- `CF_TOKEN` — CF API Token，Claude Unified Billing 代付凭证（原生透传端点用）
- `ANTHROPIC_CREDENTIAL_MODE` — `unified`（默认）/ `byok`，可选；切自有 Anthropic key 时设 `byok`
- `ANTHROPIC_API_KEY` — 自有 Anthropic key，仅 `byok` 模式需要（可选）
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
