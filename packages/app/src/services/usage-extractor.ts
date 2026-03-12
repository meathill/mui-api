/**
 * 从各 Provider 响应中提取 token 用量
 */

export interface UsageResult {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/**
 * 从 OpenAI 兼容格式响应中提取 usage（非流式）
 * CF AI Gateway /compat 端点统一返回 OpenAI 格式
 */
export function extractCompatUsage(data: Record<string, unknown>): UsageResult | null {
  const usage = data.usage as Record<string, number> | undefined;
  const model = data.model as string | undefined;
  if (!usage || !model) return null;

  return {
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
    model,
  };
}

/**
 * 从 OpenAI 兼容格式 SSE 流中提取 usage
 * 读取 tee 后的副本流，解析最后一个包含 usage 的 chunk
 */
export async function extractCompatStreamUsage(response: Response): Promise<UsageResult | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;

  const decoder = new TextDecoder();
  let buffer = '';
  let model = '';
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.model) model = data.model;
            if (data.usage) {
              inputTokens = data.usage.prompt_tokens ?? 0;
              outputTokens = data.usage.completion_tokens ?? 0;
            }
          } catch {
            // 忽略解析失败的行
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return model ? { model, inputTokens, outputTokens } : null;
}

/**
 * 从原生 Provider 响应中提取 usage（非流式）
 */
export function extractNativeUsage(provider: string, data: Record<string, unknown>): UsageResult | null {
  switch (provider) {
    case 'openai':
      return extractCompatUsage(data);

    case 'anthropic':
      return extractAnthropicUsage(data);

    case 'google-ai-studio':
      return extractGoogleUsage(data);

    default:
      return null;
  }
}

function extractAnthropicUsage(data: Record<string, unknown>): UsageResult | null {
  const usage = data.usage as Record<string, number> | undefined;
  const model = data.model as string | undefined;
  if (!usage || !model) return null;

  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    model,
  };
}

function extractGoogleUsage(data: Record<string, unknown>): UsageResult | null {
  const usageMetadata = data.usageMetadata as Record<string, number> | undefined;
  const modelVersion = (data.modelVersion as string) ?? 'unknown';
  if (!usageMetadata) return null;

  return {
    inputTokens: usageMetadata.promptTokenCount ?? 0,
    outputTokens: usageMetadata.candidatesTokenCount ?? 0,
    model: modelVersion,
  };
}

/**
 * 从原生 Provider SSE 流中提取 usage
 */
export async function extractNativeStreamUsage(provider: string, response: Response): Promise<UsageResult | null> {
  // OpenAI 和 CF AI Gateway compat 模式使用相同的 SSE 格式
  if (provider === 'openai') {
    return extractCompatStreamUsage(response);
  }

  const reader = response.body?.getReader();
  if (!reader) return null;

  const decoder = new TextDecoder();
  let buffer = '';
  let result: UsageResult | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
          const extracted = extractNativeUsage(provider, data);
          if (extracted && extracted.inputTokens > 0) {
            result = extracted;
          }
        } catch {
          // 忽略解析失败的行
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return result;
}
