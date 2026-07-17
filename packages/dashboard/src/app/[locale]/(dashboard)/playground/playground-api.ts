import type {
  GrokImageOptions,
  GrokVideoOptions,
  TokenInfo,
  TokenUsagePayload,
  TtsRequestBody,
  VideoApiResponse,
} from './playground-types';
import { getApiBase, toTokenInfo } from './playground-utils';

/**
 * Playground 的网络请求层：直连 /v1 接口的 fetch 封装 + SSE 流读取。
 * 从 playground-utils.ts 抽出，与数据/谓词/转换器分离。
 */

type ChatStreamChunk = {
  choices?: Array<{
    delta?: { content?: string; reasoning_content?: string };
    usage?: TokenUsagePayload;
  }>;
  usage?: TokenUsagePayload;
};

export function sendImageGenerationRequest(params: {
  apiKey: string;
  model: string;
  prompt: string;
  isGrok: boolean;
  grokOptions: GrokImageOptions;
  signal: AbortSignal;
}) {
  const body = params.isGrok
    ? {
        model: params.model,
        prompt: params.prompt,
        n: params.grokOptions.count,
        aspect_ratio: params.grokOptions.aspectRatio,
        resolution: params.grokOptions.resolution,
        response_format: 'b64_json',
      }
    : {
        model: params.model,
        prompt: params.prompt,
        size: '1024x1024',
        quality: 'low',
        output_format: 'jpeg',
        output_compression: 80,
        moderation: 'low',
      };
  return fetch(`${getApiBase()}/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: params.signal,
  });
}

export function sendImageEditRequest(params: {
  apiKey: string;
  model: string;
  prompt: string;
  images: File[];
  isGrok: boolean;
  grokOptions: GrokImageOptions;
  signal: AbortSignal;
}) {
  if (params.isGrok) return sendGrokImageEditRequest(params);

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

async function sendGrokImageEditRequest(params: {
  apiKey: string;
  model: string;
  prompt: string;
  images: File[];
  grokOptions: GrokImageOptions;
  signal: AbortSignal;
}) {
  const images = await Promise.all(params.images.map(fileToDataUrl));
  const references = images.map((url) => ({ type: 'image_url', url }));
  const imageBody = references.length === 1 ? { image: references[0] } : { images: references };
  return fetch(`${getApiBase()}/v1/images/edits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      prompt: params.prompt,
      ...imageBody,
      aspect_ratio: params.grokOptions.aspectRatio,
      resolution: params.grokOptions.resolution,
      response_format: 'b64_json',
    }),
    signal: params.signal,
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return `data:${file.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

export async function sendVideoGenerationRequest(params: {
  apiKey: string;
  model: string;
  prompt: string;
  image?: File | null;
  options: GrokVideoOptions;
  signal: AbortSignal;
}) {
  const imageUrl = params.image ? await fileToDataUrl(params.image) : undefined;
  return fetch(`${getApiBase()}/v1/videos/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      prompt: params.prompt,
      duration: params.options.duration,
      aspect_ratio: params.options.aspectRatio,
      resolution: params.options.resolution,
      ...(imageUrl ? { image: { url: imageUrl } } : {}),
    }),
    signal: params.signal,
  });
}

export function getVideoGenerationRequest(params: { apiKey: string; requestId: string; signal: AbortSignal }) {
  return fetch(`${getApiBase()}/v1/videos/${encodeURIComponent(params.requestId)}`, {
    headers: { Authorization: `Bearer ${params.apiKey}` },
    signal: params.signal,
  });
}

export async function pollVideoGeneration(params: {
  apiKey: string;
  requestId: string;
  signal: AbortSignal;
  intervalMs?: number;
  onUpdate: (data: VideoApiResponse) => void;
}): Promise<VideoApiResponse> {
  while (true) {
    const response = await getVideoGenerationRequest(params);
    if (!response.ok) throw new Error(await readApiError(response));
    const data = (await response.json()) as VideoApiResponse;
    params.onUpdate(data);
    if (data.status !== 'pending') return data;
    await waitForPoll(params.intervalMs ?? 3_000, params.signal);
  }
}

async function readApiError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return data?.error?.message ?? `Request failed (${response.status})`;
}

function waitForPoll(delayMs: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, delayMs);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeoutId);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

export async function sendChatRequest(params: {
  apiKey: string;
  model: string;
  prompt: string;
  images: File[];
  signal: AbortSignal;
}) {
  const isKimiK3 = params.model === 'kimi-k3';
  const imageParts = isKimiK3
    ? await Promise.all(
        params.images.map(async (file) => ({ type: 'image_url', image_url: { url: await fileToDataUrl(file) } })),
      )
    : [];
  const content = imageParts.length > 0 ? [...imageParts, { type: 'text', text: params.prompt }] : params.prompt;
  return fetch(`${getApiBase()}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      messages: [{ role: 'user', content }],
      stream: true,
      ...(isKimiK3 ? { reasoning_effort: 'max', max_completion_tokens: 16_384 } : {}),
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
    onReasoning: (reasoning: string) => void;
    onUsage: (tokenInfo: TokenInfo) => void;
  },
) {
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let fullReasoning = '';
  let pending = '';

  if (!reader) return { content: fullResponse, reasoning: fullReasoning };

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
        const firstChoice = parsed.choices?.[0];
        const reasoning = firstChoice?.delta?.reasoning_content;
        if (reasoning) {
          fullReasoning += reasoning;
          handlers.onReasoning(fullReasoning);
        }
        const content = firstChoice?.delta?.content;
        if (content) {
          fullResponse += content;
          handlers.onContent(fullResponse);
        }
        const tokenInfo = toTokenInfo(parsed.usage ?? firstChoice?.usage);
        if (tokenInfo) handlers.onUsage(tokenInfo);
      } catch {
        // 忽略单个 SSE 片段解析失败，后续片段仍可继续读取。
      }
    }
  }

  return { content: fullResponse, reasoning: fullReasoning };
}
