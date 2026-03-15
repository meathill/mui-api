# Uni-Gateway

> 统一 AI API 网关 - 将多种 AI 服务封装为 OpenAI 兼容接口

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono)](https://hono.dev/)

## 功能特性

- 🔌 **OpenAI 兼容接口** - 透传 `/v1/chat/completions`
- 💰 **按量计费** - 实时计算 Token 消耗并扣费
- 🔑 **API Key 管理** - 安全的密钥生成与验证
- 🚦 **并发控制** - 防止滥用，可调整每用户限制
- 📧 **邮件通知** - 新用户领卡 + 充值成功通知

## 技术栈

- **运行时**: Cloudflare Workers
- **框架**: Hono
- **存储**:
  - Cloudflare KV（用户余额、API Key、并发）
  - Cloudflare D1（使用日志、领卡凭证）
- **邮件**: Resend

## 快速开始

### 1. 安装依赖

```bash
cd packages/app
pnpm install
```

### 2. 配置环境变量

创建 `.dev.vars` 文件：

```bash
CF_AIG_TOKEN=your-cf-ai-gateway-token
RESEND_API_KEY=re_xxx
ADMIN_SECRET=your-admin-secret
ADMIN_EMAIL=admin@example.com
BASE_URL=http://localhost:5173
FROM_EMAIL=noreply@yourdomain.com
```

> **说明**：各 AI Provider 的 API Key 在 [CF AI Gateway 控制台](https://dash.cloudflare.com/?to=/:account/ai/ai-gateway) 配置（Stored Keys / Unified Billing），本服务只需 `CF_AIG_TOKEN` 认证网关。

### 3. 配置 D1 和 KV

```bash
# 创建 D1 数据库
wrangler d1 create mui-api

# 创建 KV namespace
wrangler kv namespace create KV

# 应用数据库迁移
pnpm db:migrate
```

### 4. 启动开发服务器

```bash
pnpm dev
```

## API 接口

### 管理员接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/admin/recharge` | 充值（自动区分新老用户） |
| POST | `/admin/set-concurrency` | 设置用户最大并发数 |

**充值示例**：
```bash
curl -X POST http://localhost:5173/admin/recharge \
  -H "X-Admin-Secret: your-secret" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "amount": 10}'
```

### OpenAI 兼容接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/v1/chat/completions` | Chat Completions（支持流式） |
| GET | `/v1/models` | 列出可用模型 |

**调用示例**：
```bash
curl http://localhost:5173/v1/chat/completions \
  -H "Authorization: Bearer sk-gw-xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### 领卡接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/claim?token=xxx` | 领卡页面 |
| POST | `/api/claim` | Token 换取 API Key |

## 计费规则

模型定价通过 Dashboard 管理后台的「模型管理」页面配置，存储在 D1 `models` 表中。
每条模型记录包含：输入价格、输出价格（$/1M tokens）、加价倍率（最低 0.01x）。

支持的 Provider：`openai`、`anthropic`、`google-ai-studio`。
所有请求通过 [CF AI Gateway](https://developers.cloudflare.com/ai-gateway/) 转发。

## 开发

```bash
# 运行测试
pnpm test

# 生成数据库迁移
pnpm db:generate

# 部署
pnpm deploy
```

## License

MIT
