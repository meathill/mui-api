/**
 * 从各 Provider 上游响应中提取 token usage，用于计费
 * 四路 shape：openai-compat、anthropic messages、gemini generateContent、workers-ai 原生
 */

export interface UsageResult {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

type ProviderKey = 'openai' | 'anthropic' | 'google-ai-studio' | 'workers-ai';

// ==================== 非流式 ====================

export function extractUsage(provider: string, data: Record<string, unknown>): UsageResult | null {
  switch (provider as ProviderKey) {
    case 'openai':
      return extractOpenAIUsage(data);
    case 'anthropic':
      return extractAnthropicUsage(data);
    case 'google-ai-studio':
      return extractGeminiUsage(data);
    case 'workers-ai':
      return extractWorkersAiUsage(data);
    default:
      return null;
  }
}

function extractOpenAIUsage(data: Record<string, unknown>): UsageResult | null {
  const usage = data.usage as Record<string, number> | undefined;
  const model = (data.model as string | undefined) ?? 'unknown';
  if (!usage) return null;
  return {
    inputTokens: usage.prompt_tokens ?? usage.input_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? usage.output_tokens ?? 0,
    model,
  };
}

function extractAnthropicUsage(data: Record<string, unknown>): UsageResult | null {
  const usage = data.usage as Record<string, number> | undefined;
  const model = (data.model as string | undefined) ?? 'unknown';
  if (!usage) return null;
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    model,
  };
}

function extractGeminiUsage(data: Record<string, unknown>): UsageResult | null {
  const meta = data.usageMetadata as Record<string, number> | undefined;
  const model = (data.modelVersion as string | undefined) ?? (data.model as string | undefined) ?? 'unknown';
  if (!meta) return null;
  return {
    inputTokens: meta.promptTokenCount ?? 0,
    outputTokens: meta.candidatesTokenCount ?? 0,
    model,
  };
}

/** Workers AI 原生（非 anthropic 的 @cf/* 模型）：usage 多数为 OpenAI 风格 */
function extractWorkersAiUsage(data: Record<string, unknown>): UsageResult | null {
  const usage = data.usage as Record<string, number> | undefined;
  const model = (data.model as string | undefined) ?? 'unknown';
  if (!usage) return null;
  return {
    inputTokens: usage.prompt_tokens ?? usage.input_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? usage.output_tokens ?? 0,
    model,
  };
}

// ==================== 流式 ====================

/**
 * 从 SSE 流中提取 usage
 * 用 tee 后的副本调用；内部读到流结束为止
 */
export async function extractStreamUsage(provider: string, response: Response): Promise<UsageResult | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;

  const decoder = new TextDecoder();
  let buffer = '';
  let model = 'unknown';
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
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(line.slice(6));
        } catch {
          continue;
        }
        const extracted = extractChunkUsage(provider, data);
        if (extracted) {
          if (extracted.inputTokens) inputTokens = extracted.inputTokens;
          if (extracted.outputTokens) outputTokens = extracted.outputTokens;
          if (extracted.model !== 'unknown') model = extracted.model;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (inputTokens === 0 && outputTokens === 0) return null;
  return { model, inputTokens, outputTokens };
}

/**
 * 单个 SSE chunk 里的 usage 提取
 * - openai：最后 chunk 的 data.usage 带 prompt/completion_tokens
 * - anthropic：message_start.message.usage.input_tokens、message_delta.usage.output_tokens
 * - gemini：每个 chunk 都带 usageMetadata（最后 chunk 的最新）
 * - workers-ai：最后 chunk 的 usage
 */
function extractChunkUsage(provider: string, data: Record<string, unknown>): UsageResult | null {
  if (provider === 'anthropic') {
    const type = data.type as string | undefined;
    if (type === 'message_start') {
      const msg = data.message as Record<string, unknown> | undefined;
      const usage = msg?.usage as Record<string, number> | undefined;
      const model = (msg?.model as string | undefined) ?? 'unknown';
      if (usage) return { model, inputTokens: usage.input_tokens ?? 0, outputTokens: 0 };
    } else if (type === 'message_delta') {
      const usage = data.usage as Record<string, number> | undefined;
      if (usage) return { model: 'unknown', inputTokens: 0, outputTokens: usage.output_tokens ?? 0 };
    }
    return null;
  }
  if (provider === 'google-ai-studio') {
    return extractGeminiUsage(data);
  }
  // openai / workers-ai 同形
  return extractOpenAIUsage(data) ?? extractWorkersAiUsage(data);
}
