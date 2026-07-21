/**
 * OpenAI chat.completions ↔ Gemini generateContent 双向翻译。
 *
 * 本服务对外只暴露 OpenAI 兼容接口，标准客户端（opencode 等）发的是
 * { messages, max_tokens, ... }，而 @google/genai 需要 { contents, config }，
 * 响应同理。翻译层让 google-ai-studio provider 对任意 OpenAI 客户端可用。
 *
 * 暂不支持：tools / tool_choice / 非文本 content（图片等）——命中时由路由返回 400。
 * usage 映射为 OpenAI 形（prompt_tokens 等），计费按 openai provider 解析。
 */

type JsonBody = Record<string, unknown>;

type GeminiPart = { text?: string; thought?: boolean };
type GeminiContent = { role: 'user' | 'model'; parts: { text: string }[] };
type GeminiCandidate = { content?: { parts?: GeminiPart[] }; finishReason?: string };
type GeminiResponseLike = {
  candidates?: GeminiCandidate[];
  usageMetadata?: Record<string, unknown>;
  modelVersion?: string;
};

export type ChatCompletionMeta = { id: string; created: number; model: string };

/** 返回请求体里第一个翻译层不支持的特性名，全部支持时返回 null */
export function findUnsupportedChatFeature(body: JsonBody): string | null {
  if (Array.isArray(body.tools) && body.tools.length > 0) return 'tools';
  if (body.tool_choice !== undefined) return 'tool_choice';
  const messages = Array.isArray(body.messages) ? body.messages : [];
  for (const raw of messages) {
    const msg = raw as JsonBody;
    if (msg.role === 'tool' || msg.role === 'function') return `role=${msg.role} 消息`;
    if (!Array.isArray(msg.content)) continue;
    for (const part of msg.content as JsonBody[]) {
      if (part?.type !== 'text') return `content 类型 ${String(part?.type)}`;
    }
  }
  return null;
}

/** OpenAI chat body → Gemini generateContent 参数（假定已通过 findUnsupportedChatFeature 校验） */
export function translateChatRequest(body: JsonBody): { contents: GeminiContent[]; config: JsonBody } {
  const contents: GeminiContent[] = [];
  const systemParts: string[] = [];

  for (const raw of (body.messages as JsonBody[]) ?? []) {
    const text = contentToText(raw.content);
    if (raw.role === 'system' || raw.role === 'developer') {
      systemParts.push(text);
      continue;
    }
    contents.push({ role: raw.role === 'assistant' ? 'model' : 'user', parts: [{ text }] });
  }

  const config: JsonBody = {};
  if (systemParts.length > 0) config.systemInstruction = systemParts.join('\n\n');
  const maxTokens = numberOrUndefined(body.max_completion_tokens) ?? numberOrUndefined(body.max_tokens);
  if (maxTokens !== undefined) config.maxOutputTokens = maxTokens;
  if (typeof body.temperature === 'number') config.temperature = body.temperature;
  if (typeof body.top_p === 'number') config.topP = body.top_p;
  const stopSequences = toStopSequences(body.stop);
  if (stopSequences) config.stopSequences = stopSequences;

  return { contents, config };
}

/** Gemini 非流式响应 → OpenAI chat.completion */
export function toOpenAIChatCompletion(resp: GeminiResponseLike, meta: ChatCompletionMeta): JsonBody {
  const candidate = resp.candidates?.[0];
  return {
    id: meta.id,
    object: 'chat.completion',
    created: meta.created,
    model: meta.model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: joinParts(candidate?.content?.parts) },
        finish_reason: finishReasonToOpenAI(candidate?.finishReason) ?? 'stop',
      },
    ],
    usage: usageMetadataToOpenAI(resp.usageMetadata),
  };
}

/**
 * Gemini 流式 chunk → OpenAI chat.completion.chunk 列表。
 * 文本与 finish_reason 分开发（对齐 OpenAI 习惯，finish chunk 带 usage）。
 */
export function toOpenAIChatChunks(chunk: GeminiResponseLike, meta: ChatCompletionMeta, isFirst: boolean): JsonBody[] {
  const base = { id: meta.id, object: 'chat.completion.chunk', created: meta.created, model: meta.model };
  const candidate = chunk.candidates?.[0];
  const text = joinParts(candidate?.content?.parts);
  const finishReason = finishReasonToOpenAI(candidate?.finishReason);
  const chunks: JsonBody[] = [];

  if (text !== '' || isFirst) {
    const delta: JsonBody = isFirst ? { role: 'assistant', content: text } : { content: text };
    chunks.push({ ...base, choices: [{ index: 0, delta, finish_reason: null }] });
  }
  if (finishReason) {
    const usage = usageMetadataToOpenAI(chunk.usageMetadata);
    chunks.push({
      ...base,
      choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
      ...(usage ? { usage } : {}),
    });
  }
  return chunks;
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => (typeof (part as JsonBody)?.text === 'string' ? ((part as JsonBody).text as string) : ''))
    .join('');
}

/** 拼接文本 parts，跳过 thinking part（thought: true） */
function joinParts(parts: GeminiPart[] | undefined): string {
  if (!parts) return '';
  return parts
    .filter((part) => part.thought !== true && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
}

function finishReasonToOpenAI(reason: string | undefined): string | null {
  if (!reason) return null;
  if (reason === 'MAX_TOKENS') return 'length';
  if (['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY'].includes(reason)) {
    return 'content_filter';
  }
  return 'stop';
}

function usageMetadataToOpenAI(meta: Record<string, unknown> | undefined): JsonBody | undefined {
  if (!meta) return undefined;
  const promptTokens = numberOrUndefined(meta.promptTokenCount) ?? 0;
  const cachedTokens = numberOrUndefined(meta.cachedContentTokenCount) ?? 0;
  const candidateTokens = numberOrUndefined(meta.candidatesTokenCount) ?? 0;
  const thoughtTokens = numberOrUndefined(meta.thoughtsTokenCount) ?? 0;
  return {
    // Gemini 语义下 promptTokenCount 已包含 cached 部分，与 OpenAI prompt_tokens 一致
    prompt_tokens: promptTokens,
    completion_tokens: candidateTokens + thoughtTokens,
    total_tokens: numberOrUndefined(meta.totalTokenCount) ?? promptTokens + candidateTokens + thoughtTokens,
    prompt_tokens_details: { cached_tokens: cachedTokens },
    completion_tokens_details: { reasoning_tokens: thoughtTokens },
  };
}

function toStopSequences(stop: unknown): string[] | undefined {
  if (typeof stop === 'string') return [stop];
  if (Array.isArray(stop) && stop.every((item) => typeof item === 'string')) return stop as string[];
  return undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
