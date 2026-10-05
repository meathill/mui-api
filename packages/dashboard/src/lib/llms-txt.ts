import { SITE_NAME, SITE_URL } from './seo';

const API_BASE = 'https://api.muirouter.com';

/**
 * /llms.txt — 面向 AI 爬虫的短版本站点摘要。
 * 文案只复用既有产品/API/定价/MCP 表述，不发明价格或功能。
 */
export function buildLlmsTxt(): string {
  return `# ${SITE_NAME}

> OpenAI-compatible AI API router and MCP server: one key routes requests to OpenAI, Anthropic Claude, Google Gemini, xAI Grok, Cloudflare Workers AI, Xiaomi MiMo and more. Per-token billing, no subscription, no VPN.

MuiRouter sits between your app and every major AI provider. Send one OpenAI-compatible request and it routes to the right upstream — one key, one bill. When you need a provider-specific feature, native passthrough reaches each provider's own API without changing keys.

## Product

- [Home](${SITE_URL}/): product overview and quick start
- [AI API Router](${SITE_URL}/ai-router): how the router works
- [LLM Router](${SITE_URL}/llm-router): LLM-focused routing guide
- [OpenAI-Compatible Router](${SITE_URL}/openai-compatible-router): drop-in OpenAI SDK Base URL swap
- [MCP Router](${SITE_URL}/mcp-router): streamable-HTTP MCP for Claude, Cursor and Cline
- [MCP Setup Guide](${SITE_URL}/mcp): client-by-client MCP configuration
- [What Is an MCP Server?](${SITE_URL}/mcp-server): terminology and when to use one
- [opencode](${SITE_URL}/opencode): terminal coding agent integration
- [Pricing](${SITE_URL}/pricing): public per-token price reference (no subscriptions)
- [Models](${SITE_URL}/models): supported providers and models
- [Blog](${SITE_URL}/blog): product and engineering notes

## Optional

- [Full site summary](${SITE_URL}/llms-full.txt): longer copy covering API endpoints, MCP tools and pricing policy
- [Sitemap](${SITE_URL}/sitemap.xml)
- [Privacy](${SITE_URL}/privacy)
- [Terms](${SITE_URL}/terms)
- [Contact](${SITE_URL}/contact)
`;
}

/**
 * /llms-full.txt — 更完整的产品/API/定价/MCP 摘要。
 * 价格只陈述「按 token、无订阅」与「官方刊例价参考」策略，不列出具体数字。
 */
export function buildLlmsFullTxt(): string {
  return `# ${SITE_NAME}

> High-performance AI API gateway and MCP router. Seamlessly route, load-balance, and cache LLMs and MCP servers with zero latency overhead.

MuiRouter is an OpenAI-compatible AI API router: one API key routes requests to OpenAI, Anthropic Claude, Google Gemini, xAI Grok, Cloudflare Workers AI, Xiaomi MiMo and more, with per-token billing, native passthrough and a built-in MCP server. No VPN, no subscription.

## Product overview

- One key for every major LLM — OpenAI, Claude, DeepSeek, GLM, Qwen, Kimi, Grok, MiniMax, Gemini, Workers AI, Xiaomi MiMo and more.
- Drop-in compatible with the OpenAI SDK: change Base URL and API Key only.
- Native API passthrough preserves provider-specific features (Claude long context, Gemini multimodal, Grok agentic coding, Anthropic /v1/messages for Claude Code).
- Pay per use: no monthly fees, no seats, no package caps. Top up a wallet and balance never expires.
- Proxied through Cloudflare's global edge network (~300+ nodes).

## API documentation

Base URL: ${API_BASE}

OpenAI-compatible and related HTTP endpoints (Bearer auth with a \`sk-gw-\` key):

- \`POST ${API_BASE}/v1/chat/completions\` — Chat Completions
- \`POST ${API_BASE}/v1/responses\` — Responses API (OpenAI Codex CLI and similar)
- \`POST ${API_BASE}/v1/messages\` — Anthropic-native Messages (Claude Code / Anthropic SDK)
- \`POST ${API_BASE}/v1/images/generations\` — image generation
- \`POST ${API_BASE}/v1/images/edits\` — image edits
- \`POST ${API_BASE}/v1/videos/generations\` — submit async video generation
- \`GET ${API_BASE}/v1/videos/:request_id\` — poll a video job
- \`GET ${API_BASE}/v1/models\` — list available models
- \`GET ${API_BASE}/v1/public-models\` — public model catalog
- \`GET ${API_BASE}/v1/balance\` / \`/v1/usage\` / \`/v1/recharges\` — account self-service
- \`GET ${API_BASE}/health\` — health check

OpenAI SDK example: set \`base_url\` to \`${API_BASE}/v1\` and use your \`sk-gw-\` key. For Claude Code / Anthropic SDK, set \`ANTHROPIC_BASE_URL=${API_BASE}\` and \`ANTHROPIC_AUTH_TOKEN\` to the same key.

Full marketing guides: ${SITE_URL}/openai-compatible-router, ${SITE_URL}/ai-router, ${SITE_URL}/opencode.

## Pricing

- No subscription plans and no package caps — pay only for what you use.
- Public price reference: ${SITE_URL}/pricing (USD / 1M tokens). Numbers on that page are provider-published list prices, not MuiRouter markups.
- Effective billing follows the model pricing configured in the dashboard; if a dashboard price differs from the public reference page, the dashboard configuration wins.
- The public pricing page covers core text and multimodal token prices; audio, image generation, Live API, Batch, grounding and tool charges may be billed separately when used.

## MCP integration

Endpoint: \`POST ${API_BASE}/mcp\` with \`Authorization: Bearer sk-gw-xxxxxxxx\`.

MuiRouter exposes a streamable-HTTP MCP server and router. Connect Claude Desktop, Claude Code, Cursor and Cline to route LLM calls, aggregate multiple MCP servers, and use built-in account tools with your own key.

Protocol support:

- Modern Spec (2026-07-28): stateless streamable-HTTP, explicit \`_meta\` & headers (\`MCP-Protocol-Version\`), server discovery, DNS rebinding protection.
- Legacy Compatibility (2025-11-25 / 2025-06-18): automatic handshake negotiation for initialize-based clients.

Built-in MCP tools:

- \`get_balance\` — wallet balance, total top-ups and total spending
- \`get_usage\` — paginate API usage (filter by model / time range)
- \`list_recharges\` — paginate top-up records
- \`list_models\` — list supported models and pricing fields
- \`create_topup_session\` — create a Stripe top-up session / payment link
- \`image_generation\` — OpenAI-compatible image generation through MuiRouter

Setup guides: ${SITE_URL}/mcp (client-by-client), ${SITE_URL}/mcp-router, ${SITE_URL}/mcp-server.

Claude Code / Claude Desktop example (\`~/.claude/mcp.json\` or Claude Desktop config):

\`\`\`json
{
  "mcpServers": {
    "muirouter": {
      "url": "${API_BASE}/mcp",
      "headers": {
        "Authorization": "Bearer sk-gw-xxxxxxxx"
      }
    }
  }
}
\`\`\`

## Key pages

- Home: ${SITE_URL}/
- Pricing: ${SITE_URL}/pricing
- Models: ${SITE_URL}/models
- AI router: ${SITE_URL}/ai-router
- LLM router: ${SITE_URL}/llm-router
- OpenAI-compatible router: ${SITE_URL}/openai-compatible-router
- MCP router: ${SITE_URL}/mcp-router
- MCP setup: ${SITE_URL}/mcp
- MCP server explained: ${SITE_URL}/mcp-server
- opencode: ${SITE_URL}/opencode
- Blog: ${SITE_URL}/blog
- About: ${SITE_URL}/about
- Contact: ${SITE_URL}/contact
- Privacy: ${SITE_URL}/privacy
- Terms: ${SITE_URL}/terms
- Short llms.txt: ${SITE_URL}/llms.txt
- Sitemap: ${SITE_URL}/sitemap.xml

## Optional

- Compare: ${SITE_URL}/muirouter-vs-openrouter, ${SITE_URL}/litellm-vs-muirouter, ${SITE_URL}/openrouter-alternatives, ${SITE_URL}/best-llm-gateway
- Provider gateways: ${SITE_URL}/claude-api-gateway, ${SITE_URL}/gpt-api-gateway, ${SITE_URL}/gemini-api-gateway, ${SITE_URL}/grok-api-gateway
`;
}

export const LLMS_TXT_CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400';

export function createLlmsTxtResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': LLMS_TXT_CACHE_CONTROL,
    },
  });
}
