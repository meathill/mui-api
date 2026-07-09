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

// 网络请求 / SSE 流读取已拆到 ./playground-api.ts

export const MAX_HISTORY_ITEMS = 30;
export const MAX_TTS_VOICE_SAMPLE_BYTES = 7_500_000;
export const TTS_OUTPUT_FORMAT = 'wav';

export type TtsVoiceOption = {
  id: string;
  label: string;
};

const NO_TIER_PRICING = {
  cachedInputPrice: null,
  cacheWritePrice: null,
  longContextThresholdTokens: null,
  longContextInputPrice: null,
  longContextCachedInputPrice: null,
  longContextCacheWritePrice: null,
  longContextOutputPrice: null,
} as const;

export const BUILT_IN_IMAGE_MODELS: ModelInfo[] = [
  {
    id: 'gpt-image-2',
    provider: 'openai',
    upstreamModelId: 'gpt-image-2',
    inputPrice: 8,
    outputPrice: 30,
    markupRate: 1.2,
    ...NO_TIER_PRICING,
  },
];

export const BUILT_IN_TTS_MODELS: ModelInfo[] = [
  {
    id: 'mimo-v2.5-tts',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2.5-tts',
    inputPrice: 0,
    outputPrice: 0,
    markupRate: 1.2,
    ...NO_TIER_PRICING,
  },
  {
    id: 'mimo-v2.5-tts-voiceclone',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2.5-tts-voiceclone',
    inputPrice: 0,
    outputPrice: 0,
    markupRate: 1.2,
    ...NO_TIER_PRICING,
  },
  {
    id: 'mimo-v2.5-tts-voicedesign',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2.5-tts-voicedesign',
    inputPrice: 0,
    outputPrice: 0,
    markupRate: 1.2,
    ...NO_TIER_PRICING,
  },
  {
    id: 'mimo-v2-tts',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2-tts',
    inputPrice: 0,
    outputPrice: 0,
    markupRate: 1.2,
    ...NO_TIER_PRICING,
  },
];

const BUILT_IN_PLAYGROUND_MODELS = [...BUILT_IN_IMAGE_MODELS, ...BUILT_IN_TTS_MODELS];

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

export function getApiBase() {
  return process.env.NEXT_PUBLIC_API_BASE || '';
}

// ---- 模型展示元数据（从已有字段派生，无需数据库新增字段）----

/** provider 显示名（品牌专有名词，硬编码不走 i18n）。 */
export const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  'google-ai-studio': 'Google',
  'workers-ai': 'Workers AI',
  'xiaomi-mimo': 'Xiaomi MiMo',
  grok: 'xAI Grok',
};

/** 分组展示顺序；未列出的 provider 追加到末尾，保证新 provider 不会被丢弃。 */
export const PROVIDER_ORDER: readonly string[] = [
  'anthropic',
  'openai',
  'google-ai-studio',
  'workers-ai',
  'xiaomi-mimo',
  'grok',
];

export type ModelGroup = {
  provider: string;
  items: string[];
};

/** 按 provider 把模型分组，组内保留原顺序，组间按 PROVIDER_ORDER 排序。 */
export function groupModelsByProvider(models: ModelInfo[]): ModelGroup[] {
  const idsByProvider = new Map<string, string[]>();
  for (const model of models) {
    const ids = idsByProvider.get(model.provider) ?? [];
    ids.push(model.id);
    idsByProvider.set(model.provider, ids);
  }

  const groups: ModelGroup[] = [];
  for (const provider of PROVIDER_ORDER) {
    const items = idsByProvider.get(provider);
    if (items) {
      groups.push({ provider, items });
      idsByProvider.delete(provider);
    }
  }
  for (const [provider, items] of idsByProvider) {
    groups.push({ provider, items });
  }
  return groups;
}

/** 返回模型能力标签的 i18n key 列表（成品文案由组件用 t() 渲染）。 */
export function getModelCapabilityTagKeys(model: ModelInfo): string[] {
  const keys: string[] = [];
  if (model.longContextThresholdTokens != null) {
    keys.push('tagLongContext');
  }
  if (model.cachedInputPrice != null) {
    keys.push('tagCaching');
  }
  return keys;
}

/** 取基础输入/输出价（单位：美元/百万 tokens）；任一缺失返回 null。 */
export function getModelPrice(model: ModelInfo): { input: number; output: number } | null {
  if (model.inputPrice == null || model.outputPrice == null) {
    return null;
  }
  return { input: model.inputPrice, output: model.outputPrice };
}

/** 价格数字格式化（JS 已天然去尾零：3 / 1.25 / 0.05）。 */
export function formatModelPrice(value: number): string {
  return `$${value}`;
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

export function appendBuiltInPlaygroundModels(models: ModelInfo[]) {
  const mergedModels = [...models];
  for (const model of BUILT_IN_PLAYGROUND_MODELS) {
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
