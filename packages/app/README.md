# Uni-Gateway

> 统一 AI API 网关 - 将多种 AI 服务封装为 OpenAI 兼容接口

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![Hono](https://img.shields.io/badge/Hono-E36002?logo=hono)](https://hono.dev/)

## 功能特性

- 🔌 **OpenAI 兼容接口** - 透传 `/v1/chat/completions`、`/v1/responses`（Codex CLI 等 Responses API 客户端）
- 💰 **按量计费** - 实时计算 Token 消耗并扣费
- 🔑 **API Key 管理** - 安全的密钥生成与验证
- 🚦 **并发控制** - 防止滥用，可调整每用户限制
- 📧 **邮件通知** - 新用户领卡 + 充值成功通知

## 技术栈

- **运行时**: Cloudflare Workers
- **框架**: Hono
- **存储**:
  - Cloudflare KV（用户余额、API Key、并发展示镜像）
  - Durable Object（每用户并发 lease 权威状态）
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
MIMO_API_KEY=your-xiaomi-mimo-api-key
RESEND_API_KEY=re_xxx
ADMIN_SECRET=your-admin-secret
ADMIN_EMAIL=admin@example.com
BASE_URL=http://localhost:5173
FROM_EMAIL=noreply@yourdomain.com
```

> **说明**：OpenAI / Google AI Studio 的 API Key 在 [CF AI Gateway 控制台](https://dash.cloudflare.com/?to=/:account/ai/ai-gateway) 配置（Stored Keys / Unified Billing），本服务使用 `CF_AIG_TOKEN` 认证网关。Xiaomi MiMo 不走 AI Gateway，直接使用 `MIMO_API_KEY` 调用 OpenAI 兼容接口；如需覆盖端点，可配置 `MIMO_BASE_URL`，默认值为 `https://api.xiaomimimo.com/v1`。

### 3. 配置 D1 和 KV

```bash
# 创建 D1 数据库
wrangler d1 create mui-api

# 创建 KV namespace
wrangler kv namespace create KV

# 应用共享数据库迁移（SQL、schema 和迁移脚本统一由 packages/shared-db 维护）
pnpm --dir ../shared-db run db:migrate:local
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
| POST | `/v1/chat/completions` | Chat Completions（支持流式；MiMo TTS 也通过此接口透传 `audio` 参数） |
| POST | `/v1/responses` | Responses API（仅支持 openai provider；用于 OpenAI Codex CLI 等使用新版 wire format 的客户端） |
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

**Codex CLI 接入示例**（`~/.codex/config.toml`；`base_url` 不带 `/responses` 后缀，Codex 会按 `wire_api` 自动追加，且不会展开 `base_url` 里的环境变量，需要写字面值）：
```toml
model_provider = "mui-api"
model = "gpt-4o"

[model_providers.mui-api]
name = "Mui Router"
base_url = "http://localhost:5173/v1"
env_key = "MUI_API_KEY"
wire_api = "responses"
```

### 领卡接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/claim?token=xxx` | 领卡页面 |
| POST | `/api/claim` | Token 换取 API Key |

## 计费规则

模型定价通过 Dashboard 管理后台的「模型管理」页面配置，存储在 D1 `models` 表中。
每条模型记录包含：输入价格、输出价格（$/1M tokens）、加价倍率（最低 0.01x）。

支持的 Provider：`openai`、`anthropic`、`google-ai-studio`、`workers-ai`、`xiaomi-mimo`。
其中 `openai` / `google-ai-studio` 通过 [CF AI Gateway](https://developers.cloudflare.com/ai-gateway/) 转发，`xiaomi-mimo` 直连 Xiaomi MiMo OpenAI 兼容接口，`anthropic` / `workers-ai` 通过 Workers AI binding 调用。
MiMo TTS 系列当前按官方限时免费记录为 `0 / 0`，后续官方价格变化时需要同步更新 `models` 表。

## 并发限流实现

- 并发准入由 `ConcurrencyLimiterDO` 负责，按 `userId` 串行化管理活跃 lease
- 默认 lease TTL 为 90 秒，每 30 秒续租一次，覆盖长请求和流式响应
- `user:{userId}` 中的 `concurrency` 仅是 Durable Object 回写的展示镜像，不参与限流判断
- lease 会在响应 body 正常结束、客户端取消、或流读取报错时释放；不再依赖 middleware `finally` 直接减计数

## 一次性维护

从旧版 KV 并发计数迁移到 Durable Object 后，需要把历史 `user:*` 记录中的 `concurrency` 清零一次，避免 dashboard 继续显示旧脏值。

在仓库根目录执行：

```bash
CF_ACCOUNT_ID=xxx CF_API_TOKEN=xxx KV_NAMESPACE_ID=xxx pnpm reset:concurrency-mirror -- --dry-run
CF_ACCOUNT_ID=xxx CF_API_TOKEN=xxx KV_NAMESPACE_ID=xxx pnpm reset:concurrency-mirror
```

脚本会分页扫描 `user:*`，读取并保留原 metadata，只把 `concurrency` 重置为 `0`。

## 开发

```bash
# 运行测试
pnpm test

# 生成共享数据库迁移
pnpm --dir ../shared-db run db:generate

# 部署
pnpm deploy
```

本地开发时，`packages/app` 和 `packages/dashboard` 默认共用仓库根目录下的 `.wrangler/state/v3`。
这样在两个服务之间联调时，会读写同一份本地 D1 / KV 状态；自动化测试仍使用各自隔离的测试环境，不共享这份状态。

## License

MIT
