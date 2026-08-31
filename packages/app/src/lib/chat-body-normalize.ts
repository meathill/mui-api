/**
 * 按 provider 归一化 OpenAI 兼容 chat 请求体，抹平上游参数差异：
 * - openai：gpt-5 系列拒绝 `max_tokens`（要求 `max_completion_tokens`），全部现役
 *   chat 模型都接受新参数名，统一改写无回归风险
 * - grok：grok-4 系列为推理模型，xAI 文档明确 `stop` / `presence_penalty` /
 *   `frequency_penalty` 会直接报错（https://docs.x.ai/developers/model-capabilities/text/reasoning）
 * 其余 provider 原样返回。
 */

type ChatBody = Record<string, unknown>;

const GROK_UNSUPPORTED_PARAMS = ['stop', 'presence_penalty', 'frequency_penalty'] as const;

// opencode 默认给 gpt-5.6-sol 配置的 reasoningEffort 变体会被原样透传到上游，
// Claude 经 compat 转发时不认识这些字段会直接 400，故在 anthropic 分支剥离
const ANTHROPIC_UNSUPPORTED_PARAMS = [
  'reasoningEffort',
  'reasoning_effort',
  'reasoning',
  'thinking',
  'thought',
] as const;

export function normalizeChatBody(body: ChatBody, provider: string): ChatBody {
  let normalized: ChatBody = body;

  // 计费必需：OpenAI 兼容流式只有显式 stream_options.include_usage=true 时，上游才在终态 SSE 携带 usage。
  // 216→16 漏记的根因即大量 SDK（OpenAI/JS 6.34 等）默认不带该字段，导致 extractStreamUsage 全程无 usage。
  // 网关侧强制补齐，避免客户端记忆负担；对非 OpenAI 兼容 provider（如 workers-ai 的 env.AI.run）该字段被忽略，无副作用。
  if (normalized.stream === true) {
    const so = normalized.stream_options as Record<string, unknown> | undefined;
    if (!so || so.include_usage !== true) {
      normalized = { ...normalized, stream_options: { ...(so ?? {}), include_usage: true } };
    }
  }

  if (provider === 'openai') {
    if (normalized.max_tokens === undefined) return normalized;
    const { max_tokens, ...rest } = normalized;
    // 两者都传时以新参数为准，只保证不把 max_tokens 发给上游
    return { ...rest, max_completion_tokens: rest.max_completion_tokens ?? max_tokens };
  }

  if (provider === 'grok') {
    if (!GROK_UNSUPPORTED_PARAMS.some((key) => key in normalized)) return normalized;
    const rest = { ...normalized };
    for (const key of GROK_UNSUPPORTED_PARAMS) {
      delete rest[key];
    }
    return rest;
  }

  if (provider === 'anthropic') {
    if (!ANTHROPIC_UNSUPPORTED_PARAMS.some((key) => key in normalized)) return normalized;
    const rest = { ...normalized };
    for (const key of ANTHROPIC_UNSUPPORTED_PARAMS) {
      delete rest[key];
    }
    return rest;
  }

  return normalized;
}
