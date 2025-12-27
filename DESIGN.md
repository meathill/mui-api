# AI Gateway & 计费系统 (Hono + Cloudflare D1 版)

## 1. 项目概述 (Project Overview)

**名称**：Uni-Gateway (暂定名)
**目标**：构建一个基于 Cloudflare Workers 的高性能 AI 聚合网关。
**核心价值**：

1. **统一接口**：将 Google Gemini、Replicate 等非标接口统一封装为 **OpenAI 兼容接口**。
2. **按量计费**：通过拦截请求计算 Token 消耗，实时扣除用户余额。
3. **极简售卖**：无繁琐注册流程。用户通过支付链接购买 -> 自动生成/充值账户 -> 获取 API Key -> 直接使用。
4. **技术栈**：Hono (Server), Cloudflare D1 (Database), Drizzle ORM, Stripe (Payment), React (Simple Claim UI).

## 2. 数据库设计 (Schema Design)

*请使用 Drizzle ORM 定义以下 Schema。*

```typescript
// db/schema.ts 伪代码参考

// 1. 用户表：以邮箱为核心身份
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // UUID
  email: text('email').unique().notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// 2. 钱包表：存储余额
export const wallets = sqliteTable('wallets', {
  userId: text('user_id').primaryKey().references(() => users.id),
  balance: real('balance').default(0.0000), // 存储单位：CNY 或 USD
  currency: text('currency').default('CNY'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// 3. API 密钥表
export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  keyPrefix: text('key_prefix').notNull(), // 展示用 "sk-gw-..."
  keyHash: text('key_hash').notNull(),     // 鉴权用 sha256
  name: text('name'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// 4. 领卡凭证表 (一次性查看 Key)
export const claimTokens = sqliteTable('claim_tokens', {
  token: text('token').primaryKey(),
  userId: text('user_id').notNull(),
  tempRawKey: text('temp_raw_key').notNull(), // 暂时存储明文
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  used: integer('used', { mode: 'boolean' }).default(false),
});

// 5. 模型定价表
export const models = sqliteTable('models', {
  id: text('id').primaryKey(), // 你的网关暴露的模型名，如 "gpt-4o", "gemini-pro"
  provider: text('provider').notNull(), // "openai", "google", "replicate"
  upstreamModelId: text('upstream_model_id'), // 上游真实模型名
  inputPrice: real('input_price'), // 每 1M token 价格或每 1K 价格，统一单位
  outputPrice: real('output_price'),
  markupRate: real('markup_rate').default(1.2), // 利润倍率
});

// 6. 使用日志
export const usageLogs = sqliteTable('usage_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  apiKeyId: text('api_key_id'),
  modelId: text('model_id'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  cost: real('cost'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

```

## 3. 核心 API 逻辑 (API Logic)

### 3.1 支付与发货 (Webhook & Claim)

**Route**: `POST /webhooks/stripe`

* **功能**：接收 Stripe `checkout.session.completed` 事件。
* **逻辑**：
1. 验证 Webhook 签名。
2. 根据 `customer_email` 查找或创建 User。
3. 增加 Wallet 余额。
4. **关键步骤**：如果用户没有 API Key，生成一个新的 `sk-gw-xxx`。
5. 生成一个 16 位的随机 `claimToken`，将 API Key 的**明文**存入 `claimTokens` 表，设置 15 分钟过期。
6. (可选) 调用 Resend 发送邮件，包含链接：`https://gateway.your-domain.com/claim?token={claimToken}`。



**Route**: `POST /api/claim`

* **功能**：前端页面调用此接口获取 Key。
* **逻辑**：
1. 校验 Token 是否过期、是否已用。
2. 返回 `tempRawKey`。
3. **立即销毁**：更新 DB，标记 `used=true`，并清空 `tempRawKey` 字段。确保数据库中不再保留明文 Key。



### 3.2 统一网关转发 (The Proxy Core)

**Route**: `POST /v1/chat/completions` (OpenAI Compatible)

**Middleware (Auth)**:

1. 解析 Header `Authorization: Bearer sk-gw-xxx`。
2. 计算 Hash，查询 `apiKeys` 表。
3. 查询 `wallets` 表，确保 `balance > 0.01`。
4. 将 `userId` 注入 Context。

**Controller (Handler)**:

1. **Request Parsing**: 获取 Body 中的 `model` (e.g., "gemini-1.5-pro")。
2. **Model Routing**:
* **IF OpenAI**:
* Target: `https://api.openai.com/v1/chat/completions`
* Auth: 替换为你的 `OPENAI_API_KEY`。


* **IF Google Gemini**:
* Target: `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`
* **Adapter**: 编写一个简单的 `OpenAI2Gemini` 函数，将 `messages` 转换为 `contents`。
* Auth: 使用 `GOOGLE_API_KEY`。




3. **Streaming**: 必须支持 SSE (Server-Sent Events) 透传。
4. **Billing (Async)**:
* 使用 `c.executionCtx.waitUntil` (Cloudflare Worker 特性) 在响应返回后执行。
* 计算 Cost = `(InputTokens * Price + OutputTokens * Price) * Markup`。
* 事务更新：`UPDATE wallets SET balance = balance - Cost`。
* 记录日志。



## 4. 前端页面 (Claim Page)

**技术栈**: React (Vite) 或简单的 Hono JSX 渲染。
**页面逻辑**:

1. URL 路由: `/claim?token=...`
2. UI 展示:
* 加载中状态...
* 调用后端 API 成功 -> 展示大大的 API Key 输入框 (只读) + "一键复制" 按钮。
* 警告文案: "此 Key 仅显示一次，请务必现在保存。如遗失需联系管理员重置。"
* 调用失败/过期 -> 展示 "链接已失效，请检查邮件或联系客服"。



## 5. 开发分步指令 (Prompt Plan)

你可以按顺序复制以下指令给 AI 助手：

**Phase 1: 基础架构**

> "初始化一个 Cloudflare Workers 项目，使用 Hono 框架。安装 Drizzle ORM 和 D1 绑定。请根据我提供的 Schema 设计，编写 `src/db/schema.ts` 并生成迁移文件。配置 `wrangler.toml` 绑定 D1。"

**Phase 2: 支付与领卡闭环**

> "实现 Stripe Webhook (`/webhooks/stripe`) 处理支付成功事件：创建用户、充值余额、生成 API Key 并创建 Claim Token。
> 接着实现 `POST /api/claim` 接口，用于通过 Token 换取一次性的明文 Key。
> 最后，写一个简单的 HTML/React 页面字符串，在 `GET /claim` 路由中返回，包含前端 fetch 逻辑来展示 Key。"

**Phase 3: OpenAI 转发与计费**

> "实现 `/v1/chat/completions`。
> 1. 编写中间件：验证 Bearer Token 并检查 D1 中的余额。
> 2. 编写转发逻辑：如果是 `gpt-` 开头的模型，透传给 OpenAI。
> 3. **重点**：实现异步计费。利用 `c.executionCtx.waitUntil`，在请求结束后解析 Usage 并扣除余额。不要让数据库操作阻塞 API 响应。"
>
>

**Phase 4: Gemini 适配 (高难度项)**

> "在 `/v1/chat/completions` 中增加对 `gemini-` 开头模型的支持。
> 请编写一个适配器函数，将 OpenAI 的 `messages` 格式转换为 Google Gemini 的 `generateContent` 格式。
> 调用 Google API 后，再将 Gemini 的响应转换回 OpenAI 的格式返回给客户端。需要支持流式 (stream: true) 响应的转换。"
