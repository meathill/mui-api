# 部署指南

## 概览

本仓库没有统一的一键部署命令，`packages/app` 与 `packages/dashboard` 需要分别构建和部署。

- `packages/shared-db` 负责共享 D1 schema、migration 与迁移脚本
- `packages/app` 负责 API Worker
- `packages/dashboard` 负责用户侧与管理后台

如果本次发布包含数据库结构变更，先执行 `packages/shared-db` 的生产迁移，再部署应用。

## 发布前检查

建议在仓库根目录按以下顺序执行：

```bash
pnpm --dir packages/app run test
pnpm --dir packages/dashboard run test
pnpm run typecheck
pnpm --dir packages/app run build
pnpm --dir packages/dashboard run build
```

如果变更涉及 API 行为或页面主流程，再补充对应 E2E。

## 数据库迁移

### 本地

```bash
pnpm --dir packages/shared-db run db:migrate:local
```

### 生产

```bash
pnpm --dir packages/shared-db run db:migrate:prod
```

说明：

- 共享 D1 的 schema、migration 和迁移入口统一由 `packages/shared-db` 维护
- `packages/app` 和 `packages/dashboard` 只保留运行时 bindings，不各自维护一份 SQL 历史

## API Worker 部署

### 必需 secrets

- `CF_AIG_TOKEN`
- `ADMIN_SECRET`
- `ADMIN_EMAIL`
- `BASE_URL`
- `FROM_EMAIL`

### 可选 secrets

- `RESEND_API_KEY`
- `MIMO_API_KEY` — 启用 `xiaomi-mimo` provider 时必需，直连 Xiaomi MiMo OpenAI 兼容接口
- `MIMO_BASE_URL` — Xiaomi MiMo OpenAI 兼容接口地址，默认 `https://api.xiaomimimo.com/v1`

### 构建与部署

```bash
pnpm --dir packages/app run build
pnpm --dir packages/app run deploy
```

## Dashboard 部署

### 必需 secrets

- `BETTER_AUTH_SECRET`
- `RESEND_API_KEY`
- `FROM_EMAIL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### 构建与部署

```bash
pnpm --dir packages/dashboard run build
pnpm --dir packages/dashboard run deploy
```

## 配置约束

- 两个 package 共享同一个 D1 数据库与 KV namespace，binding name 必须保持一致
- 如果改动了 Cloudflare bindings 或类型定义，先在对应 package 中执行 `cf-typegen`
- 本地开发时应显式关闭 remote bindings，避免本地联调误写远程 D1 / KV

## 本地联调

`packages/app dev`、`packages/dashboard dev` 和 `packages/shared-db db:migrate:local` 默认共用仓库根目录下同一份 `.wrangler/state/v3`，便于联调共享本地状态。
