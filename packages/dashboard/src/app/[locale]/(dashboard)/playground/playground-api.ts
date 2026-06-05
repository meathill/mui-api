import type { TokenInfo, TokenUsagePayload, TtsRequestBody } from './playground-types';
import { getApiBase, toTokenInfo } from './playground-utils';

/**
 * Playground 的网络请求层：直连 /v1 接口的 fetch 封装 + SSE 流读取。
 * 从 playground-utils.ts 抽出，与数据/谓词/转换器分离。
 */

type ChatStreamChunk = {
  choices?: Array<{ delta?: { content?: string } }>;
  usage?: TokenUsagePayload;
};

export function sendImageGenerationRequest(params: {
  apiKey: string;
  model: string;
  prompt: string;
  signal: AbortSignal;
}) {
  return fetch(`${getApiBase()}/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      prompt: params.prompt,
      size: '1024x1024',
      quality: 'low',
      output_format: 'jpeg',
      output_compression: 80,
      moderation: 'low',
    }),
    signal: params.signal,
  });
}

export function sendImageEditRequest(params: {
  apiKey: string;
  model: string;
  prompt: string;
  images: File[];
  signal: AbortSignal;
}) {
  const form = new FormData();
  form.append('model', params.model);
  form.append('prompt', params.prompt);
  form.append('quality', 'low');
  form.append('output_format', 'jpeg');
  form.append('output_compression', '80');
  form.append('moderation', 'low');
  for (const file of params.images) {
    form.append('image[]', file, file.name);
  }

  return fetch(`${getApiBase()}/v1/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.apiKey}` },
    body: form,
    signal: params.signal,
  });
}

export function sendChatRequest(params: { apiKey: string; model: string; prompt: string; signal: AbortSignal }) {
  return fetch(`${getApiBase()}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: [{ role: 'user', content: params.prompt }],
      stream: true,
    }),
    signal: params.signal,
  });
}

export function sendTtsRequest(params: { apiKey: string; body: TtsRequestBody; signal: AbortSignal }) {
  return fetch(`${getApiBase()}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(params.body),
    signal: params.signal,
  });
}

export async function readChatStream(
  res: Response,
  handlers: {
    onContent: (content: string) => void;
    onUsage: (tokenInfo: TokenInfo) => void;
  },
) {
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let pending = '';

  if (!reader) return fullResponse;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = pending + decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    pending = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data) as ChatStreamChunk;
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          handlers.onContent(fullResponse);
        }
        const tokenInfo = toTokenInfo(parsed.usage);
        if (tokenInfo) handlers.onUsage(tokenInfo);
      } catch {
        // 忽略单个 SSE 片段解析失败，后续片段仍可继续读取。
      }
    }
  }

  return fullResponse;
}
