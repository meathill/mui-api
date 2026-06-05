# MuiRouter Dashboard

MuiRouter 的管理面板，基于 Next.js 16 + OpenNext 部署在 Cloudflare Workers 上。

## 技术栈

- **框架**：Next.js 16 + OpenNext（`@opennextjs/cloudflare`）
- **认证**：better-auth（drizzle adapter）
- **数据库**：Cloudflare D1（SQLite），与 `packages/app` 共享
- **KV 存储**：Cloudflare KV，与 `packages/app` 共享
- **UI**：Tailwind CSS 4 + Base UI

## 架构

- 用户体系统一使用 better-auth 的 `user` 表，不存在独立的用户表
- 业务数据（余额、API Key 等）存储在 KV 中，以 better-auth `user.id` 为 key
- 用量日志、模型配置等存储在 D1 业务表中
- 邮件发送使用 Resend

## 本地开发

```bash
pnpm --dir ../shared-db run db:migrate:local  # 初始化共享本地 D1
pnpm run dev               # 启动开发服务器（端口 3035）
```

`packages/dashboard` 与 `packages/app` 在本地开发时默认共用仓库根目录下的 `.wrangler/state/v3`，
便于联调真实的本地 D1 / KV 状态。自动化测试仍使用隔离环境，不依赖这份共享状态。

## 部署

```bash
pnpm --dir ../shared-db run db:migrate:prod  # 执行远程 D1 migration
pnpm run deploy            # 构建 + 部署到 Cloudflare
```

共享 D1 的 schema、migration 和迁移脚本统一由 `packages/shared-db` 维护。
`packages/dashboard` 与 `packages/app` 只保留各自的运行时 binding。

需要配置的 Cloudflare Secrets：
- `BETTER_AUTH_SECRET`
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Stripe 充值配置

- 用户侧固定支持 `$10 / $20 / $50` 三档充值，使用 Stripe Checkout 一次性支付
- 支付成功后通过 `POST /api/stripe/webhook` 入账，前端回跳页只负责展示结果和轮询状态
- Stripe webhook 至少订阅以下事件：
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
- `STRIPE_WEBHOOK_SECRET` 必须使用 Stripe webhook endpoint 返回的 signing secret
