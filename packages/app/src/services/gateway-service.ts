/**
 * CF AI Gateway 统一代理服务
 * 所有 AI 请求通过 CF AI Gateway 转发
 * Provider 的 API key 在 CF AI Gateway 控制台配置（Stored Keys / Unified Billing），
 * 本服务通过 cf-aig-authorization 头认证网关
 *
 * @see https://developers.cloudflare.com/ai-gateway/configuration/authentication/
 * @see https://developers.cloudflare.com/ai-gateway/get-started/
 */

const SUPPORTED_PROVIDERS = new Set(['openai', 'anthropic', 'google-ai-studio', 'workers-ai']);

// 原生代理模式下，某些 provider 需要额外的 header
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
    private workersAiToken: string,
  ) {
    this.baseUrl = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}`;
  }

  /**
   * OpenAI 兼容模式（compat endpoint）
   * 将请求代理到 CF AI Gateway 的 /compat/chat/completions 端点
   * model 改写为 "provider/upstreamModelId" 格式
   *
   * @see https://developers.cloudflare.com/ai-gateway/get-started/#2-send-your-first-request
   */
  async proxyCompat(
    body: Record<string, unknown>,
    provider: string,
    upstreamModel: string,
    stream: boolean,
  ): Promise<Response> {
    if (!SUPPORTED_PROVIDERS.has(provider)) {
      throw new Error(`不支持的 provider: ${provider}`);
    }

    const url = `${this.baseUrl}/compat/chat/completions`;
    const requestBody = {
      ...body,
      model: `${provider}/${upstreamModel}`,
      stream,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'cf-aig-authorization': `Bearer ${this.cfAigToken}`,
    };
    // Workers AI 通过 CF AI Gateway compat 端点时，需要 BYOK 传入 Cloudflare API Token
    if (provider === 'workers-ai') {
      headers.Authorization = `Bearer ${this.workersAiToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`CF AI Gateway 错误 (${response.status}): ${error}`);
    }

    return response;
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
    // Workers AI 以 BYOK 方式接入，额外带 Cloudflare API Token
    if (provider === 'workers-ai') {
      headers.set('Authorization', `Bearer ${this.workersAiToken}`);
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
