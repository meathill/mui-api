import type { ModelInfo } from '@/lib/api';
import type {
  AudioResult,
  HistoryItem,
  ImageApiItem,
  ImageResult,
  TokenInfo,
  TokenUsagePayload,
  TtsApiResponse,
  TtsRequestBody,
} from './playground-types';

export const MAX_HISTORY_ITEMS = 30;
export const MAX_TTS_VOICE_SAMPLE_BYTES = 7_500_000;
export const TTS_OUTPUT_FORMAT = 'wav';

export type TtsVoiceOption = {
  id: string;
  label: string;
};

export const BUILT_IN_IMAGE_MODELS: ModelInfo[] = [
  {
    id: 'gpt-image-2',
    provider: 'openai',
    upstreamModelId: 'gpt-image-2',
    inputPrice: 8,
    outputPrice: 30,
    markupRate: 1.2,
  },
];

const MIMO_V2_5_TTS_VOICES: TtsVoiceOption[] = [
  { id: 'mimo_default', label: 'MiMo 默认' },
  { id: '冰糖', label: '冰糖 / 中文女声' },
  { id: '茉莉', label: '茉莉 / 中文女声' },
  { id: '苏打', label: '苏打 / 中文男声' },
  { id: '白桦', label: '白桦 / 中文男声' },
  { id: 'Mia', label: 'Mia / English female' },
  { id: 'Chloe', label: 'Chloe / English female' },
  { id: 'Milo', label: 'Milo / English male' },
  { id: 'Dean', label: 'Dean / English male' },
];

const MIMO_V2_TTS_VOICES: TtsVoiceOption[] = [
  { id: 'mimo_default', label: 'MiMo 默认' },
  { id: 'default_zh', label: 'MiMo 中文女声' },
  { id: 'default_en', label: 'MiMo English female' },
];

type ChatStreamChunk = {
  choices?: Array<{ delta?: { content?: string } }>;
  usage?: TokenUsagePayload;
};

export function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE || '';
}

export function isImageModel(model: ModelInfo) {
  return model.id.includes('image') || Boolean(model.upstreamModelId?.includes('image'));
}

export function isTtsModel(model: ModelInfo) {
  return isTtsModelId(model.id) || Boolean(model.upstreamModelId && isTtsModelId(model.upstreamModelId));
}

export function isTtsModelId(modelId: string) {
  return modelId.toLowerCase().includes('tts');
}

export function isTtsVoiceCloneModel(modelId: string) {
  return modelId.toLowerCase().includes('voiceclone');
}

export function isTtsVoiceDesignModel(modelId: string) {
  return modelId.toLowerCase().includes('voicedesign');
}

export function getTtsVoiceOptions(modelId: string): TtsVoiceOption[] {
  if (isTtsVoiceCloneModel(modelId) || isTtsVoiceDesignModel(modelId)) {
    return [];
  }
  if (modelId === 'mimo-v2-tts') {
    return MIMO_V2_TTS_VOICES;
  }
  return MIMO_V2_5_TTS_VOICES;
}

export function getDefaultTtsVoice(modelId: string) {
  return getTtsVoiceOptions(modelId)[0]?.id ?? '';
}

export function appendBuiltInImageModels(models: ModelInfo[]) {
  const mergedModels = [...models];
  for (const model of BUILT_IN_IMAGE_MODELS) {
    if (!mergedModels.some((item) => item.id === model.id)) {
      mergedModels.push(model);
    }
  }
  return mergedModels;
}

export function parseHistory(raw: string): HistoryItem[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY_ITEMS) : [];
  } catch {
    return [];
  }
}

export function toTokenInfo(usage?: TokenUsagePayload): TokenInfo | null {
  if (!usage) return null;
  return {
    inputTokens: usage.input_tokens ?? usage.prompt_tokens ?? 0,
    outputTokens: usage.output_tokens ?? usage.completion_tokens ?? 0,
  };
}

export function toImageResult(item: ImageApiItem, index: number): ImageResult[] {
  const format = item.output_format ?? 'png';
  const mimeType = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
  if (item.b64_json) {
    return [
      {
        id: crypto.randomUUID(),
        src: `data:${mimeType};base64,${item.b64_json}`,
        mimeType,
        filename: `muirouter-image-${index + 1}.${format === 'jpeg' ? 'jpg' : format}`,
      },
    ];
  }
  if (item.url) {
    return [{ id: crypto.randomUUID(), src: item.url, mimeType, filename: `muirouter-image-${index + 1}.png` }];
  }
  return [];
}

export function toAudioResult(data: TtsApiResponse, model: string): AudioResult | null {
  const audio = data.choices?.[0]?.message?.audio;
  if (!audio?.data) return null;

  const suffix = audio.id ? `-${audio.id}` : '';
  return {
    id: crypto.randomUUID(),
    src: `data:audio/wav;base64,${audio.data}`,
    mimeType: 'audio/wav',
    filename: `${model}${suffix}.wav`,
  };
}

export function downloadImage(image: ImageResult) {
  triggerDownload(image.src, image.filename);
}

export function downloadAudio(audio: AudioResult) {
  triggerDownload(audio.src, audio.filename);
}

function triggerDownload(src: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = src;
  anchor.download = filename;
  anchor.rel = 'noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function buildTtsRequestBody(params: {
  model: string;
  text: string;
  stylePrompt: string;
  voice: string;
  voiceSampleDataUrl?: string;
}): TtsRequestBody {
  const stylePrompt = params.stylePrompt.trim();
  const messages: TtsRequestBody['messages'] = [];

  if (stylePrompt || isTtsVoiceDesignModel(params.model) || isTtsVoiceCloneModel(params.model)) {
    messages.push({ role: 'user', content: stylePrompt });
  }
  messages.push({ role: 'assistant', content: params.text.trim() });

  const audio: TtsRequestBody['audio'] = { format: TTS_OUTPUT_FORMAT };
  if (isTtsVoiceCloneModel(params.model)) {
    if (params.voiceSampleDataUrl) audio.voice = params.voiceSampleDataUrl;
  } else if (!isTtsVoiceDesignModel(params.model) && params.voice) {
    audio.voice = params.voice;
  }

  return {
    model: params.model,
    messages,
    audio,
    stream: false,
  };
}

export function getTtsVoiceSampleMimeType(file: File): string | null {
  const name = file.name.toLowerCase();
  if (file.type === 'audio/wav' || file.type === 'audio/x-wav' || name.endsWith('.wav')) {
    return 'audio/wav';
  }
  if (file.type === 'audio/mpeg' || file.type === 'audio/mp3' || name.endsWith('.mp3')) {
    return 'audio/mpeg';
  }
  return null;
}

export async function fileToTtsVoiceDataUrl(file: File): Promise<string> {
  const mimeType = getTtsVoiceSampleMimeType(file);
  if (!mimeType) {
    throw new Error('unsupported_tts_voice_sample');
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode(...chunk);
  }

  return `data:${mimeType};base64,${btoa(binary)}`;
}

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
