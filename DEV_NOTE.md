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

### KV + D1 双存储

**决策**：高频读写数据放 KV，持久化/可查询数据放 D1。

| 存储 | 用途 | 原因 |
|------|------|------|
| KV | 用户余额、API Key hash 验证、并发计数、花费统计 | 每次请求都要读，需要亚 60ms 延迟 |
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

- KV 原子递增/递减实现
- 60 秒 TTL 安全网，防止崩溃导致槽位泄漏
- 在 `finally` 块中释放槽位

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
