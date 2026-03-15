# MUI Router Dashboard

MUI Router 的管理面板，基于 Next.js 16 + OpenNext 部署在 Cloudflare Workers 上。

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
pnpm run db:migrate:local  # 初始化 D1（auth 表 + 业务表）
pnpm run dev               # 启动开发服务器（端口 3035）
```

## 部署

```bash
pnpm run db:migrate:prod   # 执行远程 D1 migration
pnpm run deploy            # 构建 + 部署到 Cloudflare
```

需要配置的 Cloudflare Secrets：
- `BETTER_AUTH_SECRET`
- `RESEND_API_KEY`
- `FROM_EMAIL`
