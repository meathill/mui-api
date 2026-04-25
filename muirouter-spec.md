# muirouter integration spec — 最小可用版

这份 spec 给 [muirouter](https://muirouter.com) 的服务端实现做参考，让
muicv（以及未来其他第三方）能用 BYOK 的方式集成 muirouter 余额查询。

**目标**：muicv 用户在 muirouter 生成自己的 API key，贴到 muicv dashboard，
muicv 服务端用这个 key 调 muirouter 拿余额展示。

不做 OAuth，不做跨站会话。第三方完全靠用户自己粘贴的 API key 调用。

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
- `packages/website/app/api/muirouter/*` —— routes
- `packages/website/migrations/0004_muirouter_link.sql` —— schema
- `packages/website/app/(dashboard)/dashboard/muirouter-section.tsx` —— UI

如果 muirouter API 还没上，muicv 这边能 graceful degrade：保存 key 后显示
"已绑定，余额查询待 muirouter API 上线"，不报错。
