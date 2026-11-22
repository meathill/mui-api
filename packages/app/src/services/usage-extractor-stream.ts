import { type UsageResult, emptyUsage, extractGeminiUsage, extractOpenAIUsage, numberOrZero } from './usage-extractors';

/**
 * 从 SSE 流中提取 usage（流式部分）。
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
        mergeChunkUsage(accumulated, extracted);
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
            mergeChunkUsage(accumulated, extracted);
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
 * 取每个维度的「最大值」即最终累计：openai 最后一个 chunk 全量带 usage，
 * anthropic message_start 给 input/cache，message_delta 给 output，互补。
 */
function mergeChunkUsage(accumulated: UsageResult, extracted: UsageResult): void {
  if (extracted.inputTokens) accumulated.inputTokens = extracted.inputTokens;
  if (extracted.cachedInputTokens) accumulated.cachedInputTokens = extracted.cachedInputTokens;
  if (extracted.cacheWriteTokens) accumulated.cacheWriteTokens = extracted.cacheWriteTokens;
  if (extracted.outputTokens) accumulated.outputTokens = extracted.outputTokens;
  if (extracted.model !== 'unknown') accumulated.model = extracted.model;
  if (extracted.serviceTier) accumulated.serviceTier = extracted.serviceTier;
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
    return extractAnthropicChunkUsage(data);
  }
  if (provider === 'google-ai-studio') {
    return extractGeminiUsage(data);
  }
  // openai / workers-ai / moonshot / xiaomi-mimo / grok / deepseek / zai / qwen / minimax / meta / longcat / hy 同形
  // DeepSeek 经 OpenCode Go 劫持后仍为 OpenAI 兼容 SSE，最后 chunk 的 data.usage 或 choices[0].usage 均已由 extractOpenAIUsage 覆盖
  return extractOpenAIUsage(data);
}

function extractAnthropicChunkUsage(data: Record<string, unknown>): UsageResult | null {
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
    return null;
  }
  if (type === 'message_delta') {
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
    return null;
  }
  if (type === 'message_stop') {
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
  }
  if (type === 'content_block_delta' || type === 'content_block_start' || type === 'content_block_stop') {
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
