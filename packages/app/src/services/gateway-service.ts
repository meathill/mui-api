/**
 * CF AI Gateway 原生透传服务
 * 用于 /providers/:provider/* 路径的透传代理；主聊天接口走 SDK / env.AI.run
 *
 * @see https://developers.cloudflare.com/ai-gateway/configuration/authentication/
 */

const SUPPORTED_PROVIDERS = new Set(['openai', 'anthropic', 'google-ai-studio', 'workers-ai']);

// 只有这些 provider 由本服务注入上游凭证（Unified Billing 代付 / 或 BYOK 自有 key）。
// allow-list 语义：不在集合内的 provider（openai / google-ai-studio / workers-ai）一律不注入代付凭证，
// 走网关 Stored Keys / 各自账号付费。新增 provider 默认「自付」，杜绝误落 Unified Billing 烧 credits。
const UNIFIED_BILLING_PROVIDERS = new Set(['anthropic']);

const PROVIDER_EXTRA_HEADERS: Record<string, Record<string, string>> = {
  anthropic: {
    'anthropic-version': '2023-06-01',
  },
};

export class GatewayService {
  private baseUrl: string;

  constructor(
    accountId: string,
    gatewayId: string,
    private cfAigToken: string,
    private cfToken: string,
    private anthropicMode: 'unified' | 'byok' = 'unified',
    private anthropicApiKey?: string,
  ) {
    this.baseUrl = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}`;
  }

  /**
   * 原生代理模式
   * 将请求透传到 CF AI Gateway 的 provider 专用端点
   * 各 provider 的 API schema 不同，需要额外 header
   *
   * @see https://developers.cloudflare.com/ai-gateway/usage/providers/openai/
   * @see https://developers.cloudflare.com/ai-gateway/usage/providers/anthropic/
   * @see https://developers.cloudflare.com/ai-gateway/usage/providers/google-ai-studio/
   */
  async proxyNative(provider: string, path: string, request: Request): Promise<Response> {
    if (!SUPPORTED_PROVIDERS.has(provider)) {
      throw new Error(`不支持的 provider: ${provider}`);
    }

    const url = `${this.baseUrl}/${provider}/${path}`;

    // 构造新的 headers，保留原始请求的 Content-Type 等
    const headers = new Headers(request.headers);
    // 移除客户端可能携带的认证 header（不应透传给上游）
    headers.delete('Authorization');
    headers.delete('x-api-key');
    headers.delete('x-goog-api-key');
    // 网关认证：Stored Keys 与 Unified Billing 都用 cf-aig-authorization
    headers.set('cf-aig-authorization', `Bearer ${this.cfAigToken}`);
    // 仅 allow-list 内的 provider（当前只有 anthropic）由本服务注入上游凭证；其余走网关 Stored Keys，不注入
    if (UNIFIED_BILLING_PROVIDERS.has(provider)) {
      if (this.anthropicMode === 'byok') {
        // BYOK：自有 key 自付。绝不带 Authorization，否则会被上游当成 CF 代付凭证
        if (!this.anthropicApiKey) {
          throw new Error('ANTHROPIC_CREDENTIAL_MODE=byok 但缺少 ANTHROPIC_API_KEY');
        }
        headers.set('x-api-key', this.anthropicApiKey);
      } else {
        // Unified Billing：由 CF 代付、扣 credits（原生透传端点需要 CF API Token）
        headers.set('Authorization', `Bearer ${this.cfToken}`);
      }
    }
    // 添加 provider 特定的额外 headers（如 Anthropic 的 anthropic-version）
    const extras = PROVIDER_EXTRA_HEADERS[provider];
    if (extras) {
      for (const [key, value] of Object.entries(extras)) {
        headers.set(key, value);
      }
    }

    const response = await fetch(url, {
      method: request.method,
      headers,
      body: request.body,
    });

    return response;
  }
}
