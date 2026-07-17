import {
  calculateGrokImageUpstreamCost,
  convertUsdTicksToInternalTokens,
  convertUsdToInternalTokens,
  type GrokImageModelId,
  type GrokImageResolution,
  isGrokImageModelId,
} from '@muirouter/shared-db/grok-image';

/**
 * 从各 Provider 上游响应中提取 token usage，用于计费。
 *
 * 拆分维度：
 *  - inputTokens：非 cache 的普通输入 token
 *  - cachedInputTokens：命中 cache 的 input token（cache read，便宜）
 *  - cacheWriteTokens：写入 cache 的 input token（仅 anthropic；cache_creation，更贵）
 *  - outputTokens：模型生成的 token
 *
 * shape：openai-compat（含 Responses API）、anthropic messages、gemini generateContent、workers-ai 原生
 */

export interface UsageResult {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  model: string;
}

type ProviderKey =
  | 'openai'
  | 'anthropic'
  | 'google-ai-studio'
  | 'workers-ai'
  | 'moonshot'
  | 'xiaomi-mimo'
  | 'grok'
  | 'grok-image';

export type GrokImageUsageContext = {
  model: GrokImageModelId;
  inputCount: number;
  outputCount: number;
  resolution: GrokImageResolution;
};

function emptyUsage(model = 'unknown'): UsageResult {
  return { model, inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0 };
}

// ==================== 非流式 ====================

export function extractUsage(
  provider: string,
  data: Record<string, unknown>,
  grokImageContext?: GrokImageUsageContext,
): UsageResult | null {
  switch (provider as ProviderKey) {
    case 'openai':
    case 'moonshot':
    case 'xiaomi-mimo':
      return extractOpenAIUsage(data);
    case 'anthropic':
      return extractAnthropicUsage(data);
    case 'google-ai-studio':
      return extractGeminiUsage(data);
    case 'workers-ai':
      return extractWorkersAiUsage(data);
    case 'grok':
      return extractOpenAIUsage(data);
    case 'grok-image':
      return extractGrokImageUsage(data, grokImageContext);
    default:
      return null;
  }
}

function extractOpenAIUsage(data: Record<string, unknown>): UsageResult | null {
  // Responses API 流式：仅终态事件（response.completed/incomplete/failed）把完整 response 对象
  // 嵌在 data.response 下、其中带 usage；非终态事件（created/in_progress/output_text.delta 等）
  // 要么没有 response 字段，要么 response.usage 缺失/为 null。chat.completion(.chunk) 从不带
  // response 字段，两种 shape 结构互斥，可安全据此判断走哪条解析路径（非流式 responses 顶层就有
  // usage，跟 chat.completion 走同一条 else 分支，不需要额外判断）。
  // typeof nested === 'object' 的判断是关键：部分 workers-ai 模型原生返回
  // { response: "纯文本", usage }，.response 是字符串而非对象，靠这个判断落回顶层 data.usage，
  // 不会误判成 Responses API 的嵌套 usage。
  const nested = data.response as Record<string, unknown> | undefined;
  const source = nested && typeof nested === 'object' && nested.usage ? nested : data;
  const choices = Array.isArray(source.choices) ? source.choices : [];
  const firstChoice = choices[0];
  const choice = firstChoice && typeof firstChoice === 'object' ? (firstChoice as Record<string, unknown>) : undefined;
  const usage =
    (source.usage as Record<string, unknown> | undefined) ?? (choice?.usage as Record<string, unknown> | undefined);
  const model = (source.model as string | undefined) ?? 'unknown';
  if (!usage) return null;

  const promptTokens = numberOrZero(usage.prompt_tokens) || numberOrZero(usage.input_tokens);
  const completionTokens = numberOrZero(usage.completion_tokens) || numberOrZero(usage.output_tokens);
  // chat.completion(.chunk) 用 prompt_tokens_details；responses 用 input_tokens_details
  // （images 的 input_tokens_details 是 {image_tokens, text_tokens}，没有 cached_tokens，读到 undefined→0，不受影响）
  const details =
    (usage.prompt_tokens_details as Record<string, unknown> | undefined) ??
    (usage.input_tokens_details as Record<string, unknown> | undefined);
  const cachedInputTokens = numberOrZero(details?.cached_tokens) || numberOrZero(usage.cached_tokens);
  // prompt_tokens 包含 cached 部分，扣掉后剩下的才是非 cache 的 input
  const inputTokens = Math.max(0, promptTokens - cachedInputTokens);
  // output_tokens_details.reasoning_tokens 已经是 output_tokens 的子集（breakdown），不需要额外累加
  return { model, inputTokens, cachedInputTokens, cacheWriteTokens: 0, outputTokens: completionTokens };
}

function extractAnthropicUsage(data: Record<string, unknown>): UsageResult | null {
  const usage = data.usage as Record<string, unknown> | undefined;
  const model = (data.model as string | undefined) ?? 'unknown';
  if (!usage) return null;
  // Anthropic 语义：input_tokens 已经是「不含 cache_read / cache_creation」的纯 input
  return {
    model,
    inputTokens: numberOrZero(usage.input_tokens),
    cachedInputTokens: numberOrZero(usage.cache_read_input_tokens),
    cacheWriteTokens: numberOrZero(usage.cache_creation_input_tokens),
    outputTokens: numberOrZero(usage.output_tokens),
  };
}

function extractGeminiUsage(data: Record<string, unknown>): UsageResult | null {
  const meta = data.usageMetadata as Record<string, unknown> | undefined;
  const model = (data.modelVersion as string | undefined) ?? (data.model as string | undefined) ?? 'unknown';
  if (!meta) return null;
  const promptTokens = numberOrZero(meta.promptTokenCount);
  const cachedInputTokens = numberOrZero(meta.cachedContentTokenCount);
  const inputTokens = Math.max(0, promptTokens - cachedInputTokens);
  return {
    model,
    inputTokens,
    cachedInputTokens,
    cacheWriteTokens: 0,
    outputTokens: numberOrZero(meta.candidatesTokenCount),
  };
}

/** Workers AI 原生（非 anthropic 的 @cf/* 模型）：usage 多数为 OpenAI 风格 */
function extractWorkersAiUsage(data: Record<string, unknown>): UsageResult | null {
  return extractOpenAIUsage(data);
}

/** xAI 图片成本换算为内部 output token；outputPrice 固定为 $1/1M 内部 tokens。 */
function extractGrokImageUsage(data: Record<string, unknown>, context?: GrokImageUsageContext): UsageResult | null {
  const usage = data.usage as Record<string, unknown> | undefined;
  const costInUsdTicks = usage?.cost_in_usd_ticks;
  if (typeof costInUsdTicks === 'number' && Number.isFinite(costInUsdTicks) && costInUsdTicks > 0) {
    return {
      model: (data.model as string | undefined) ?? context?.model ?? 'unknown',
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: convertUsdTicksToInternalTokens(costInUsdTicks),
    };
  }

  const responseModel = context?.model ?? (typeof data.model === 'string' ? data.model : undefined);
  if (!responseModel || !isGrokImageModelId(responseModel)) return null;
  const responseImageCount = Array.isArray(data.data) ? data.data.length : 0;
  const outputCount = responseImageCount || context?.outputCount || 0;
  if (outputCount === 0) return null;
  const upstreamCost = calculateGrokImageUpstreamCost({
    model: responseModel,
    inputCount: context?.inputCount ?? 0,
    outputCount,
    resolution: context?.resolution,
  });
  return {
    model: responseModel,
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: convertUsdToInternalTokens(upstreamCost),
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
  const accumulated = emptyUsage();
  let touched = false;

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
        if (!extracted) continue;
        touched = true;
        // 取每个维度的「最大值」即最终累计：openai 最后一个 chunk 全量带 usage，
        // anthropic message_start 给 input/cache，message_delta 给 output，互补。
        if (extracted.inputTokens) accumulated.inputTokens = extracted.inputTokens;
        if (extracted.cachedInputTokens) accumulated.cachedInputTokens = extracted.cachedInputTokens;
        if (extracted.cacheWriteTokens) accumulated.cacheWriteTokens = extracted.cacheWriteTokens;
        if (extracted.outputTokens) accumulated.outputTokens = extracted.outputTokens;
        if (extracted.model !== 'unknown') accumulated.model = extracted.model;
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!touched) return null;
  if (
    accumulated.inputTokens === 0 &&
    accumulated.cachedInputTokens === 0 &&
    accumulated.cacheWriteTokens === 0 &&
    accumulated.outputTokens === 0
  ) {
    return null;
  }
  return accumulated;
}

/**
 * 单个 SSE chunk 里的 usage 提取
 * - openai：最后 chunk 的 data.usage 带 prompt/completion_tokens 与 prompt_tokens_details.cached_tokens
 * - anthropic：message_start.message.usage.input_tokens + cache_read_input_tokens + cache_creation_input_tokens；
 *             message_delta.usage.output_tokens
 * - gemini：每个 chunk 都带 usageMetadata（最后 chunk 的最新）
 * - workers-ai / xiaomi-mimo / grok：OpenAI 兼容 usage
 * - moonshot：最后一个 chunk 的 choices[0].usage
 */
function extractChunkUsage(provider: string, data: Record<string, unknown>): UsageResult | null {
  if (provider === 'anthropic') {
    const type = data.type as string | undefined;
    if (type === 'message_start') {
      const msg = data.message as Record<string, unknown> | undefined;
      const usage = msg?.usage as Record<string, unknown> | undefined;
      const model = (msg?.model as string | undefined) ?? 'unknown';
      if (usage) {
        return {
          model,
          inputTokens: numberOrZero(usage.input_tokens),
          cachedInputTokens: numberOrZero(usage.cache_read_input_tokens),
          cacheWriteTokens: numberOrZero(usage.cache_creation_input_tokens),
          outputTokens: numberOrZero(usage.output_tokens),
        };
      }
    } else if (type === 'message_delta') {
      const usage = data.usage as Record<string, unknown> | undefined;
      if (usage) {
        return {
          model: 'unknown',
          inputTokens: 0,
          cachedInputTokens: 0,
          cacheWriteTokens: 0,
          outputTokens: numberOrZero(usage.output_tokens),
        };
      }
    }
    return null;
  }
  if (provider === 'google-ai-studio') {
    return extractGeminiUsage(data);
  }
  // openai / workers-ai / moonshot / xiaomi-mimo / grok 同形
  return extractOpenAIUsage(data);
}

function numberOrZero(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
