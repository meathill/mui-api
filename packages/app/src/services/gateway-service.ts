/**
 * CF AI Gateway 原生透传服务
 * 用于 /providers/:provider/* 路径的透传代理；主聊天接口走 SDK / env.AI.run
 *
 * @see https://developers.cloudflare.com/ai-gateway/configuration/authentication/
 */

const SUPPORTED_PROVIDERS = new Set(['openai', 'anthropic', 'google-ai-studio', 'workers-ai']);

// 走自有账号 + AI Gateway Stored Keys 付费；其余由 CF 代付费，需带 CF API Token
const SELF_PAID_PROVIDERS = new Set(['openai', 'google-ai-studio']);

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
    // Stored Keys 模式统一用 cf-aig-authorization 认证网关
    headers.set('cf-aig-authorization', `Bearer ${this.cfAigToken}`);
    // 非自有账号付费的 provider 统一由 CF 代付费，带 CF API Token
    if (!SELF_PAID_PROVIDERS.has(provider)) {
      headers.set('Authorization', `Bearer ${this.cfToken}`);
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
