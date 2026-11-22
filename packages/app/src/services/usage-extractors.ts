import {
  calculateGrokImageUpstreamCost,
  convertUsdTicksToInternalTokens,
  convertUsdToInternalTokens,
  type GrokImageModelId,
  type GrokImageResolution,
  isGrokImageModelId,
} from '@muirouter/shared-db/grok-image';

/**
 * 从各 Provider 上游响应中提取 token usage，用于计费（非流式部分）。
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
  // 上游回显的 service_tier（如 fast/priority/flex），决定计费倍率；仅 OpenAI 兼容响应携带
  serviceTier?: string;
}

type ProviderKey =
  | 'openai'
  | 'anthropic'
  | 'google-ai-studio'
  | 'workers-ai'
  | 'moonshot'
  | 'xiaomi-mimo'
  | 'deepseek'
  | 'opencode-go'
  | 'zai'
  | 'qwen'
  | 'minimax'
  | 'meta'
  | 'longcat'
  | 'hy'
  | 'grok'
  | 'grok-image';

export type GrokImageUsageContext = {
  model: GrokImageModelId;
  inputCount: number;
  outputCount: number;
  resolution: GrokImageResolution;
};

export function emptyUsage(model = 'unknown'): UsageResult {
  return { model, inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0 };
}

export function numberOrZero(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export function extractUsage(
  provider: string,
  data: Record<string, unknown>,
  grokImageContext?: GrokImageUsageContext,
): UsageResult | null {
  switch (provider as ProviderKey) {
    case 'openai':
    case 'moonshot':
    case 'xiaomi-mimo':
    case 'deepseek':
    case 'opencode-go':
    case 'zai':
    case 'qwen':
    case 'minimax':
    case 'meta':
    case 'longcat':
    case 'hy':
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
      // 未知 provider（例如将来新增的 opencode-go 代理模型）按 OpenAI 兼容兜底，
      // 避免因 switch 漏枚举导致 usage 被静默丢弃（H3）。
      // DeepSeek 经 Go 劫持时仍以原 provider='deepseek' 调用，但上游实为 Go 的 OpenAI 形状，
      // 此兜底同样保证解析不丢失。
      return extractOpenAIUsage(data);
  }
}

export function extractOpenAIUsage(data: Record<string, unknown>): UsageResult | null {
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
  // service_tier：chat.completion / responses 的顶层字段（stream chunk 同样携带），
  // 上游实际应用的档位（请求 fast 但上游降级时回显 default）才是计费依据
  const serviceTier = typeof source.service_tier === 'string' && source.service_tier ? source.service_tier : undefined;
  return { model, inputTokens, cachedInputTokens, cacheWriteTokens: 0, outputTokens: completionTokens, serviceTier };
}

function extractAnthropicUsage(data: Record<string, unknown>): UsageResult | null {
  const usage = data.usage as Record<string, unknown> | undefined;
  const model = (data.model as string | undefined) ?? 'unknown';
  if (!usage) {
    console.warn(`[billing] anthropic 非流式 usage 缺失: model=${model}`);
    return null;
  }
  const result = {
    model,
    inputTokens: numberOrZero(usage.input_tokens),
    cachedInputTokens: numberOrZero(usage.cache_read_input_tokens),
    cacheWriteTokens: numberOrZero(usage.cache_creation_input_tokens),
    outputTokens: numberOrZero(usage.output_tokens),
  };
  if (result.cachedInputTokens === 0 && result.cacheWriteTokens === 0) {
    // 调试用：若原厂账单显示 cache 占比高而此处长期为 0，说明上游已启用 cache 但解析漏了
    // 仅在非零输入时打印，避免噪音
    if (result.inputTokens > 0 || result.outputTokens > 0) {
      console.warn(
        `[billing] anthropic cache 为 0: model=${model} it=${result.inputTokens} cit=${result.cachedInputTokens} cwt=${result.cacheWriteTokens} ot=${result.outputTokens}`,
      );
    }
  }
  return result;
}

export function extractGeminiUsage(data: Record<string, unknown>): UsageResult | null {
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
