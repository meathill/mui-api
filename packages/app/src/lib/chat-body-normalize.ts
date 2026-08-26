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
  if (provider === 'openai') {
    if (body.max_tokens === undefined) return body;
    const { max_tokens, ...rest } = body;
    // 两者都传时以新参数为准，只保证不把 max_tokens 发给上游
    return { ...rest, max_completion_tokens: rest.max_completion_tokens ?? max_tokens };
  }

  if (provider === 'grok') {
    if (!GROK_UNSUPPORTED_PARAMS.some((key) => key in body)) return body;
    const rest = { ...body };
    for (const key of GROK_UNSUPPORTED_PARAMS) {
      delete rest[key];
    }
    return rest;
  }

  if (provider === 'anthropic') {
    if (!ANTHROPIC_UNSUPPORTED_PARAMS.some((key) => key in body)) return body;
    const rest = { ...body };
    for (const key of ANTHROPIC_UNSUPPORTED_PARAMS) {
      delete rest[key];
    }
    return rest;
  }

  return body;
}
