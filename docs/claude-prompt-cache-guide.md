# Claude Prompt Cache 使用指引（面向客户 / 客服）

> 用途：客户反馈"调 Claude 缓存零命中、费用高"时，先按第 1 节定位入口，再按第 3/4 节给出对应结论。
> Anthropic 官方文档：https://platform.claude.com/docs/en/build-with-claude/prompt-caching

## 1. 为什么会零命中：先看入口

| 客户使用的入口 | 缓存支持 | 说明 |
| --- | --- | --- |
| `/v1/chat/completions`（OpenAI 兼容） | **无法使用** | OpenAI 格式没有 `cache_control` 的位置，且 OpenAI 的缓存是全自动的、Anthropic 不是；经本网关 compat 端点转发的请求在 Anthropic 侧永远不会建缓存 |
| `/v1/messages`（Anthropic 原生） | 支持 | 请求体里的 `cache_control` 断点会原样透传，是否命中取决于客户端写法 |
| `/providers/anthropic/*`（裸透传） | 支持 | 同上，`anthropic-beta` 头也会透传 |

**核心差异**：OpenAI 的 prompt caching 是服务端自动的，客户什么都不用做；Anthropic 必须在请求体里显式打 `cache_control` 断点。从 OpenAI SDK 迁移过来的客户最容易在这里踩坑。

## 2. 迁移到 `/v1/messages`（三行改动）

Anthropic 官方 SDK / Claude Code 只需改 base URL，鉴权头 `Authorization: Bearer sk-gw-...` 与 `x-api-key: sk-gw-...` 均可：

```python
# Python：base_url 不带 /v1，SDK 会自动拼出 {base_url}/v1/messages
client = Anthropic(
    api_key="sk-gw-xxx",
    base_url="https://api.muirouter.com",
)
```

```typescript
// TypeScript：同上，baseURL 不带 /v1
const client = new Anthropic({
  apiKey: 'sk-gw-xxx',
  baseURL: 'https://api.muirouter.com',
});
```

```bash
# Claude Code
export ANTHROPIC_BASE_URL=https://api.muirouter.com
export ANTHROPIC_AUTH_TOKEN=sk-gw-xxx
```

## 3. cache_control 正确写法

在**重复内容的末尾**打断点（system、tools、历史消息均可，最多 4 个断点）：

```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 1024,
  "system": [
    {
      "type": "text",
      "text": "<很长且每次请求都一样的系统提示词、知识库、工具说明……>",
      "cache_control": { "type": "ephemeral" }
    }
  ],
  "messages": [{ "role": "user", "content": "你好" }]
}
```

需要跨更长间隔复用时可用 1h TTL（经 `/v1/messages` 已支持透传）：

```json
{ "type": "ephemeral", "ttl": "1h" }
```

## 4. 零命中自查清单

按命中概率从高到低排查：

1. **入口是否为 `/v1/chat/completions`**：是 → 先迁到 `/v1/messages`（第 2 节），否则一切调优无效
2. **请求里有没有 `cache_control`**：断点必须真的在请求体里，且不超过 4 个
3. **内容是否达到门槛**：断点前的内容 ≥ 1024 token（haiku 系列 ≥ 2048），否则 Anthropic 直接不缓存
4. **前缀是否逐字节稳定**：断点之前有任何变化（动态时间戳、随机 ID、消息顺序变化）都会使缓存失效；断点应打在稳定内容的末尾
5. **请求间隔是否超过 TTL**：默认 5 分钟，超时缓存即失效；Agent 长思考/人工介入场景建议 `ttl: "1h"`

## 5. 成本账（为什么值得修）

- 缓存**写**：1.25x 输入价（一次性）
- 缓存**读**：0.1x 输入价（省 90%）
- Agent 类多轮工作流中，稳定前缀（system + 工具定义 + 历史上下文）通常占每轮输入的 80%+，正确使用缓存可把整体成本降一半以上
- 一直零缓存时若已打了断点，每次都在付 1.25x 的写价而读不到，比不打断点还贵 25%——这正是"烧钱快"的常见原因

## 6. 如何验证生效

控制台「用量统计」页的**缓存读 / 缓存写**两列：缓存写 > 0 表示断点已生效，缓存读 > 0 表示真的命中在省钱。平台侧排查可用 `node scripts/diagnose-claude-cache.ts --user <userId>`（详见脚本头注释）。
