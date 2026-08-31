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
  if (!reader) {
    console.warn(`[billing] extractStreamUsage 无 body: provider=${provider}`);
    return null;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  const accumulated = emptyUsage();
  let touched = false;
  let chunkCount = 0;
  let lineCount = 0;
  const seenTypes = new Set<string>();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunkCount++;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        lineCount++;
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(raw);
        } catch (e) {
          console.warn(
            `[billing] SSE JSON 解析失败: provider=${provider} raw=${raw.slice(0, 200)} err=${String(e).slice(0, 100)}`,
          );
          continue;
        }
        // 调试：记录所有 anthropic type 与 openai usage 存在情况（采样，避免刷屏）
        if (provider === 'anthropic') {
          const t = (data.type as string | undefined) ?? 'no_type';
          if (!seenTypes.has(t) && seenTypes.size < 20) {
            seenTypes.add(t);
          }
          // 若该 chunk 含 usage 但 extractChunkUsage 返回 null，说明分支漏了
          const maybeUsage = (data as Record<string, unknown>).usage ?? (data as Record<string, unknown>).delta ?? null;
          if (
            maybeUsage &&
            (data.type === 'content_block_delta' ||
              data.type === 'content_block_start' ||
              data.type === 'content_block_stop')
          ) {
            console.warn(
              `[billing] anthropic 中间块含 usage 被跳过: type=${data.type} hasUsage=${!!(data as Record<string, unknown>).usage}`,
            );
          }
        } else {
          const hasUsage =
            !!(data as Record<string, unknown>).usage ||
            !!((data as Record<string, unknown>).choices as unknown[] | undefined)?.[0];
          if (hasUsage && chunkCount < 3) {
            // 采样：仅前几个 chunk 打印，避免每个请求都打大量日志
          }
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
    // 处理最后残留的 buffer（可能没有以 \n 结尾的最后一行）
    if (buffer.startsWith('data: ')) {
      const raw = buffer.slice(6).trim();
      if (raw && raw !== '[DONE]') {
        try {
          const data = JSON.parse(raw) as Record<string, unknown>;
          const extracted = extractChunkUsage(provider, data);
          if (extracted) {
            touched = true;
            if (extracted.inputTokens) accumulated.inputTokens = extracted.inputTokens;
            if (extracted.cachedInputTokens) accumulated.cachedInputTokens = extracted.cachedInputTokens;
            if (extracted.cacheWriteTokens) accumulated.cacheWriteTokens = extracted.cacheWriteTokens;
            if (extracted.outputTokens) accumulated.outputTokens = extracted.outputTokens;
            if (extracted.model !== 'unknown') accumulated.model = extracted.model;
          }
        } catch {
          // ignore
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!touched) {
    console.warn(
      `[billing] 流式全程无 usage: provider=${provider} chunks=${chunkCount} lines=${lineCount} seenTypes=[${[...seenTypes].join(',')}] accumulated=${JSON.stringify(accumulated)}`,
    );
    return null;
  }
  if (
    accumulated.inputTokens === 0 &&
    accumulated.cachedInputTokens === 0 &&
    accumulated.cacheWriteTokens === 0 &&
    accumulated.outputTokens === 0
  ) {
    console.warn(`[billing] 流式 touched 但全 0: provider=${provider} model=${accumulated.model} chunks=${chunkCount}`);
    return null;
  }
  // 成功时也采样日志，便于核对 gateway tokens 与本服务抽取是否一致（10% 采样避免噪音）
  if (Math.random() < 0.1) {
    console.log(
      `[billing] 流式抽取成功: provider=${provider} model=${accumulated.model} it=${accumulated.inputTokens} ot=${accumulated.outputTokens} cit=${accumulated.cachedInputTokens} cwt=${accumulated.cacheWriteTokens} chunks=${chunkCount}`,
    );
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
    // 兜底：任何含 usage 的 chunk 都先尝试抽取（防止新 shape 如 4.7 的 delta.usage 或 content_block 夹带 usage 被硬跳过）
    const fallbackUsage =
      (data.usage as Record<string, unknown> | undefined) ??
      ((data.delta as Record<string, unknown> | undefined)?.usage as Record<string, unknown> | undefined) ??
      ((data.message as Record<string, unknown> | undefined)?.usage as Record<string, unknown> | undefined);
    if (type === 'message_start') {
      const msg = data.message as Record<string, unknown> | undefined;
      const usage =
        (msg?.usage as Record<string, unknown> | undefined) ?? (data.usage as Record<string, unknown> | undefined);
      const model = (msg?.model as string | undefined) ?? (data.model as string | undefined) ?? 'unknown';
      if (usage) {
        return {
          model,
          inputTokens: numberOrZero(usage.input_tokens),
          cachedInputTokens: numberOrZero(usage.cache_read_input_tokens),
          cacheWriteTokens: numberOrZero(usage.cache_creation_input_tokens),
          outputTokens: numberOrZero(usage.output_tokens),
        };
      }
      console.warn(`[billing] anthropic message_start 缺少 usage: model=${model} keys=${Object.keys(data).join(',')}`);
    } else if (type === 'message_delta') {
      const usage =
        (data.usage as Record<string, unknown> | undefined) ??
        ((data.delta as Record<string, unknown> | undefined)?.usage as Record<string, unknown> | undefined);
      if (usage) {
        return {
          model: (data.model as string | undefined) ?? 'unknown',
          inputTokens: numberOrZero(usage.input_tokens),
          cachedInputTokens: numberOrZero((usage as Record<string, unknown>).cache_read_input_tokens),
          cacheWriteTokens: numberOrZero((usage as Record<string, unknown>).cache_creation_input_tokens),
          outputTokens: numberOrZero(usage.output_tokens),
        };
      }
      // 兼容：部分网关把 usage 放在 message_delta.message.usage
      const msgUsage = (data.message as Record<string, unknown> | undefined)?.usage as
        | Record<string, unknown>
        | undefined;
      if (msgUsage && numberOrZero(msgUsage.output_tokens) > 0) {
        return {
          model: 'unknown',
          inputTokens: 0,
          cachedInputTokens: 0,
          cacheWriteTokens: 0,
          outputTokens: numberOrZero(msgUsage.output_tokens),
        };
      }
    } else if (type === 'message_stop') {
      // 兜底：部分实现把最终 usage 放在 message_stop
      if (fallbackUsage) {
        return {
          model: (data.model as string | undefined) ?? 'unknown',
          inputTokens: numberOrZero(fallbackUsage.input_tokens),
          cachedInputTokens: numberOrZero((fallbackUsage as Record<string, unknown>).cache_read_input_tokens),
          cacheWriteTokens: numberOrZero((fallbackUsage as Record<string, unknown>).cache_creation_input_tokens),
          outputTokens: numberOrZero(fallbackUsage.output_tokens),
        };
      }
      return null;
    } else if (type === 'content_block_delta' || type === 'content_block_start' || type === 'content_block_stop') {
      // 若中间块意外含 usage（新模型），先抽取再决定
      if (fallbackUsage) {
        console.warn(`[billing] anthropic 中间块命中 usage: type=${type} keys=${Object.keys(fallbackUsage).join(',')}`);
        return {
          model: (data.model as string | undefined) ?? 'unknown',
          inputTokens: numberOrZero(fallbackUsage.input_tokens),
          cachedInputTokens: numberOrZero((fallbackUsage as Record<string, unknown>).cache_read_input_tokens),
          cacheWriteTokens: numberOrZero((fallbackUsage as Record<string, unknown>).cache_creation_input_tokens),
          outputTokens: numberOrZero(fallbackUsage.output_tokens),
        };
      }
      return null;
    }
    // 未知类型但含 usage，兜底抽取
    if (fallbackUsage) {
      console.warn(
        `[billing] anthropic 未识别事件但含 usage，兜底抽取: type=${type} keys=${Object.keys(fallbackUsage).join(',')}`,
      );
      return {
        model: (data.model as string | undefined) ?? 'unknown',
        inputTokens: numberOrZero(fallbackUsage.input_tokens),
        cachedInputTokens: numberOrZero((fallbackUsage as Record<string, unknown>).cache_read_input_tokens),
        cacheWriteTokens: numberOrZero((fallbackUsage as Record<string, unknown>).cache_creation_input_tokens),
        outputTokens: numberOrZero(fallbackUsage.output_tokens),
      };
    }
    // 未知 anthropic 事件类型且无 usage，记录便于 tail 发现新 shape
    if (type && type !== 'ping') {
      console.warn(`[billing] anthropic 未识别事件: type=${type} keys=${Object.keys(data).join(',').slice(0, 200)}`);
    }
    return null;
  }
  if (provider === 'google-ai-studio') {
    return extractGeminiUsage(data);
  }
  // openai / workers-ai / moonshot / xiaomi-mimo / grok / deepseek / zai / qwen / minimax / meta / longcat / hy 同形
  // DeepSeek 经 OpenCode Go 劫持后仍为 OpenAI 兼容 SSE，最后 chunk 的 data.usage 或 choices[0].usage 均已由 extractOpenAIUsage 覆盖
  return extractOpenAIUsage(data);
}

function numberOrZero(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
