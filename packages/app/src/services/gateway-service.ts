/**
 * CF AI Gateway 统一代理服务
 * 所有 AI 请求通过 CF AI Gateway 转发，不再直连 Provider
 */

// Provider 名称到 CF AI Gateway 路径的映射
const PROVIDER_CONFIGS: Record<
  string,
  {
    authHeader: string;
    authFormat: (key: string) => string;
  }
> = {
  openai: {
    authHeader: 'Authorization',
    authFormat: (key) => `Bearer ${key}`,
  },
  anthropic: {
    authHeader: 'x-api-key',
    authFormat: (key) => key,
  },
  'google-ai-studio': {
    authHeader: 'x-goog-api-key',
    authFormat: (key) => key,
  },
};

// Anthropic 需要额外的 header
const EXTRA_HEADERS: Record<string, Record<string, string>> = {
  anthropic: {
    'anthropic-version': '2023-06-01',
  },
};

export class GatewayService {
  private baseUrl: string;

  constructor(
    accountId: string,
    gatewayId: string,
    private providerKeys: Record<string, string>,
  ) {
    this.baseUrl = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}`;
  }

  /**
   * OpenAI 兼容模式
   * 将请求代理到 CF AI Gateway 的 /compat/chat/completions 端点
   * model 改写为 "provider/upstreamModelId" 格式
   */
  async proxyCompat(
    body: Record<string, unknown>,
    provider: string,
    upstreamModel: string,
    stream: boolean,
  ): Promise<Response> {
    const providerConfig = PROVIDER_CONFIGS[provider];
    if (!providerConfig) {
      throw new Error(`不支持的 provider: ${provider}`);
    }

    const apiKey = this.providerKeys[provider];
    if (!apiKey) {
      throw new Error(`未配置 ${provider} 的 API key`);
    }

    const url = `${this.baseUrl}/compat/chat/completions`;
    const requestBody = {
      ...body,
      model: `${provider}/${upstreamModel}`,
      stream,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      [providerConfig.authHeader]: providerConfig.authFormat(apiKey),
      ...EXTRA_HEADERS[provider],
    };

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
   */
  async proxyNative(provider: string, path: string, request: Request): Promise<Response> {
    const providerConfig = PROVIDER_CONFIGS[provider];
    if (!providerConfig) {
      throw new Error(`不支持的 provider: ${provider}`);
    }

    const apiKey = this.providerKeys[provider];
    if (!apiKey) {
      throw new Error(`未配置 ${provider} 的 API key`);
    }

    const url = `${this.baseUrl}/${provider}/${path}`;

    // 构造新的 headers，保留原始请求的 Content-Type 等，替换认证信息
    const headers = new Headers(request.headers);
    // 移除客户端原始的认证 header
    headers.delete('Authorization');
    headers.delete('x-api-key');
    headers.delete('x-goog-api-key');
    // 设置正确的 provider 认证
    headers.set(providerConfig.authHeader, providerConfig.authFormat(apiKey));
    // 添加 provider 特定的额外 headers
    const extras = EXTRA_HEADERS[provider];
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
