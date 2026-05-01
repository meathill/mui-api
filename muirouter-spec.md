# muirouter integration spec

这份 spec 给 [muirouter](https://muirouter.com) 的服务端实现做参考，让
muicv（以及未来其他第三方）能用 BYOK / OAuth 的方式集成 muirouter 余额与 LLM 调用。

**两条接入通道**：

1. **PAT（personal access token，sk-gw-）**：用户在 muirouter 自己生成 API key，
   贴到第三方应用——这是历史路径，不会废弃。详见 §1–§5。
2. **OAuth 2.0（2026-05 新增）**：第三方应用跳转 muirouter 授权页，用户登录授权后
   muirouter 颁发 access_token + refresh_token，第三方再调 LLM / 余额端点——这是
   muicv 当前的默认接入方式，详见 §7。

两种 token（`sk-gw-` PAT 与 `mr_at_` OAuth access_token）在受保护端点上**等价**，
按 Bearer 前缀走不同验证路径。

---

## 1. API key 约定

muirouter 现在已经在用户 sign-up 后给出 API key，建议确认 / 调整：

- **prefix**：建议 `mr_` —— 让用户和 muicv 自己的 `mui_` key 区分开
- **format**：`mr_<至少 32 字符 base62>`（推荐 sk- 风格，避免特殊字符）
- **存储**：muirouter 后端只存 `sha256(key)`，原文出现一次给用户复制
- **撤销**：用户可在 muirouter dashboard 撤销 / 重新生成

如果 prefix 已经是别的（比如 `sk-` / 没前缀），把下文 `mr_` 替换即可，但建议
统一加个独特前缀防误粘。

> **实现注**（mui-api 当前实现状态）
>
> - **路径**：`GET https://muirouter.com/v1/balance`（无 `/api` 前缀）
> - **Key 前缀**：当前为 `sk-gw-`（不是 `mr_`）。spec §1 已说明前缀可替换。
> - **币种**：返回 wallet 真实币种，目前默认 `USD`（不是 `CNY`）。
> - 错误体严格遵循 spec §2 顶层 `{error, message}` 形态。
> - 已附带的额外端点：`GET /v1/usage`、`GET /v1/recharges`、`GET /v1/public-models`、`POST /v1/topup-sessions`、`POST /webhooks/stripe`。
> - **MCP server**：`POST /mcp`（streamable-http JSON-RPC，Bearer sk-gw- 鉴权），暴露 6 个工具：`get_balance`、`get_usage`、`list_recharges`、`list_models`、`create_topup_session`、`image_generation`。

## 2. Balance endpoint（最小必需）

**`GET https://muirouter.com/v1/balance`**

### Headers

```
Authorization: Bearer <muirouter API key>
```

### Success 200

```json
{
  "currency": "CNY",
  "balance": "12.34",
  "balance_cents": 1234,
  "lifetime_topped_up_cents": 5000,
  "lifetime_spent_cents": 3766,
  "updated_at": "2026-04-25T08:30:00Z"
}
```

字段说明：

| 字段 | 类型 | 说明 |
|---|---|---|
| `currency` | string | ISO 4217 code，目前固定 `"CNY"`，未来支持 USD 时变 |
| `balance` | string | 可显示给用户的余额（保留 2 位小数）。**用 string 不用 float** 避免精度丢失 |
| `balance_cents` | number | 余额的最小单位（人民币：分），整数 |
| `lifetime_topped_up_cents` | number | 历史累计充值（最小单位） |
| `lifetime_spent_cents` | number | 历史累计消费（最小单位） |
| `updated_at` | string | ISO-8601，余额最新计算时间 |

### Error 401

```json
{
  "error": "invalid_api_key",
  "message": "API key 无效或已被撤销"
}
```

### Error 429（速率限制，可选）

```json
{
  "error": "rate_limited",
  "message": "请求过于频繁",
  "retry_after_seconds": 60
}
```

返回 `Retry-After: 60` header。

### CORS

**不需要**配置 CORS——muicv 只在服务端调用，浏览器不直接 fetch。

### 速率限制建议

每个 key 每分钟 ≤ 30 次。muicv 这边会做缓存（默认 60s），不会高频打。

---

## 3. 可选扩展 endpoint（M4 起做）

### `GET /api/v1/usage?period=month`

返回该 key 在某个时间段的消费明细，给 dashboard 画用量图。

### `POST /api/v1/topup`

发起充值。返回支付链接 / 二维码（参考 OpenRouter 的实现）。muicv dashboard
可以直接跳。

### `GET /api/v1/models`

返回 muirouter 支持的模型 + 对应价格，给 muicv 桌面 app 选模型用。

---

## 4. 集成时序

```
[用户 muicv dashboard]
    │  1. 输入 muirouter key
    ▼
[muicv worker]
    │  2. AES-GCM 加密 key，存 D1
    │  3. 立刻调 muirouter GET /api/v1/balance 验证
    ▼
[muirouter]
    │  4. 验证 key 合法
    ▼ 200 + balance
[muicv worker]
    │  5. 缓存 balance + updated_at 到 D1
    ▼
[用户 dashboard]
    │  6. 显示余额；点 "刷新" 重打
    ▼
```

**缓存策略**：muicv 每次读 dashboard 不打 muirouter。balance 在 D1 里放一份
带 `updated_at`，用户主动点 "刷新" 才重打。这样 muirouter 端压力可控。

---

## 5. 测试 checklist

muirouter 实现完之后：

```bash
# 1. 用一个真实 user 的 key 拿 200
curl -H "Authorization: Bearer mr_xxxxx" \
  https://muirouter.com/api/v1/balance

# 2. 用错误 key 拿 401
curl -H "Authorization: Bearer mr_invalid" \
  https://muirouter.com/api/v1/balance

# 3. 用撤销的 key 拿 401
# （先在 muirouter dashboard 撤销，再调）
```

---

## 6. muicv 这一端

muicv 实现见：

- `packages/website/lib/muirouter.ts` —— client
- `packages/website/app/api/muirouter/*` —— routes（OAuth 改造后入口在 `oauth/start` + `oauth/callback`）
- `packages/website/migrations/0010_muirouter_oauth.sql` —— schema
- `packages/website/app/(dashboard)/dashboard/muirouter-section.tsx` —— UI
- `packages/shared/src/muirouter-oauth.ts` —— OAuth 客户端纯逻辑

如果 muirouter API 还没上，muicv 这边能 graceful degrade：保存 key 后显示
"已绑定，余额查询待 muirouter API 上线"，不报错。

---

## 7. OAuth 2.0（2026-05 新增）

为了让 muicv 端不再走「让用户自己粘贴 API key」流程，muirouter 提供标准 authorization_code
+ refresh_token OAuth 流程。muicv 端实现的 OAuth 客户端纯逻辑见
`packages/shared/src/muirouter-oauth.ts`，本节定义服务端契约，**两端协同演进**。

### 7.1 端点

| 端点 | 方法 | 用途 |
|---|---|---|
| `https://muirouter.com/oauth/authorize` | GET | 用户登录后的授权页（dashboard 渲染，consent UI） |
| `https://api.muirouter.com/oauth/token` | POST | 用 authorization_code 换 token / refresh_token 续期 |
| `https://api.muirouter.com/oauth/revoke` | POST | 撤销整对 access+refresh |

### 7.2 Authorize

```
GET /oauth/authorize
  ?client_id=muicv
  &redirect_uri=https://muicv.com/api/muirouter/oauth/callback
  &state=<csrf-token>
  &scope=balance,llm
  &response_type=code
```

未登录 → 引导登录后回此页；已登录 → 展示 consent。
- **同意** → 生成一次性 `code`（5 min 过期），302：`{redirect_uri}?code=<code>&state=<state>`
- **拒绝** → 302：`{redirect_uri}?error=access_denied&state=<state>`

`redirect_uri` 必须命中 `oauth_clients.allowed_redirect_uris` 白名单（防 redirect_uri 劫持）。

### 7.3 Token endpoint

`POST /oauth/token`，`Content-Type: application/json`：

```json
// authorization_code
{ "grant_type": "authorization_code", "code": "...", "redirect_uri": "...",
  "client_id": "muicv", "client_secret": "cs_..." }

// refresh_token
{ "grant_type": "refresh_token", "refresh_token": "mr_rt_...",
  "client_id": "muicv", "client_secret": "cs_..." }
```

成功响应：

```json
{
  "access_token": "mr_at_...",   // 1 h 过期
  "refresh_token": "mr_rt_...",  // 30 d 过期，刷新时整对替换
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "balance,llm",
  "user": { "id": "<userId>", "email": "...", "username": "..." }
}
```

错误：HTTP 4xx + body `{ "error": "<oauth_error_code>", "error_description": "..." }`。
错误码沿用 RFC 6749：`invalid_request` / `invalid_client` / `invalid_grant` /
`unsupported_grant_type`。

### 7.4 Revoke

`POST /oauth/revoke` body `{ token, client_id, client_secret }` → 200 `{ "ok": true }`。
按 RFC 6749 §2.1，**未知 token 也返回 200**（防探测）。本端实现按 `pair_id` 把同一对
access+refresh 整对删除。

### 7.5 access_token 在受保护资源上的使用

OAuth access_token 与历史的 sk-gw PAT **同等接受**。受保护端点（`/v1/chat/completions`、
`/v1/balance`、`/v1/models`、MCP 等）的 Bearer 鉴权按前缀分发：

- `sk-gw-...` → KV `apikey:<sha256>` → userId（PAT 路径，存量）
- `mr_at_...` → D1 `oauth_tokens` → userId（OAuth 路径，新）

详见 `packages/app/src/lib/bearer-validator.ts`。

### 7.6 数据表（D1）

| 表 | 主键 | 说明 |
|---|---|---|
| `oauth_clients` | `client_id` | 注册客户端，secret 仅存 SHA-256 |
| `oauth_codes` | `code_hash` | authorization_code，5 min 过期，单次消费 |
| `oauth_tokens` | `token_hash` | access + refresh，按 `pair_id` 整对管理 |

迁移：`packages/shared-db/drizzle/0011_add_oauth_tables.sql`。

### 7.7 注册一个新 client

```bash
pnpm exec node scripts/register-oauth-client.ts \
  --client-id muicv \
  --name "muicv simple resume" \
  --redirect-uri https://muicv.com/api/muirouter/oauth/callback \
  --redirect-uri http://localhost:3070/api/muirouter/oauth/callback \
  --scopes balance,llm \
  --remote
```

脚本会生成 client_secret 并仅显示一次，把它发给客户端去配在他们的 secret 管理里
（muicv 在 wrangler 里 `MUIROUTER_OAUTH_CLIENT_SECRET`）。
