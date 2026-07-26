import { GROK_IMAGE_MODEL_IDS } from '@muirouter/shared-db/grok-image';
import { GROK_VIDEO_MODEL_IDS } from '@muirouter/shared-db/grok-video';
import type { ModelInfo } from '@/lib/api';

/** built-in 模型不参与 models.dev 收录，对外元数据一律留空。 */
const NO_METADATA = {
  displayName: null,
  contextLength: null,
  maxOutputTokens: null,
  metadataJson: null,
} as const;

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
    ...NO_METADATA,
    ...NO_TIER_PRICING,
  },
  ...GROK_IMAGE_MODEL_IDS.map((id) => ({
    id,
    provider: 'grok',
    upstreamModelId: id,
    inputPrice: 0,
    outputPrice: 1,
    markupRate: 1.05,
    ...NO_METADATA,
    ...NO_TIER_PRICING,
  })),
];

export const BUILT_IN_TTS_MODELS: ModelInfo[] = [
  {
    id: 'mimo-v2.5-tts',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2.5-tts',
    inputPrice: 0,
    outputPrice: 0,
    markupRate: 1.2,
    ...NO_METADATA,
    ...NO_TIER_PRICING,
  },
  {
    id: 'mimo-v2.5-tts-voiceclone',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2.5-tts-voiceclone',
    inputPrice: 0,
    outputPrice: 0,
    markupRate: 1.2,
    ...NO_METADATA,
    ...NO_TIER_PRICING,
  },
  {
    id: 'mimo-v2.5-tts-voicedesign',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2.5-tts-voicedesign',
    inputPrice: 0,
    outputPrice: 0,
    markupRate: 1.2,
    ...NO_METADATA,
    ...NO_TIER_PRICING,
  },
  {
    id: 'mimo-v2-tts',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2-tts',
    inputPrice: 0,
    outputPrice: 0,
    markupRate: 1.2,
    ...NO_METADATA,
    ...NO_TIER_PRICING,
  },
];

export const BUILT_IN_VIDEO_MODELS: ModelInfo[] = GROK_VIDEO_MODEL_IDS.map((id) => ({
  id,
  provider: 'grok',
  upstreamModelId: id,
  inputPrice: 0,
  outputPrice: 1,
  markupRate: 1.05,
  ...NO_METADATA,
  ...NO_TIER_PRICING,
}));

const BUILT_IN_PLAYGROUND_MODELS = [...BUILT_IN_IMAGE_MODELS, ...BUILT_IN_VIDEO_MODELS, ...BUILT_IN_TTS_MODELS];

/** provider 显示名（品牌专有名词，硬编码不走 i18n）。 */
export const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  'google-ai-studio': 'Google',
  moonshot: 'Moonshot AI',
  'workers-ai': 'Workers AI',
  'xiaomi-mimo': 'Xiaomi MiMo',
  grok: 'xAI Grok',
};

/** 分组展示顺序；未列出的 provider 追加到末尾，保证新 provider 不会被丢弃。 */
export const PROVIDER_ORDER: readonly string[] = [
  'anthropic',
  'openai',
  'google-ai-studio',
  'moonshot',
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

export function appendBuiltInPlaygroundModels(models: ModelInfo[]) {
  const mergedModels = [...models];
  for (const model of BUILT_IN_PLAYGROUND_MODELS) {
    if (!mergedModels.some((item) => item.id === model.id)) {
      mergedModels.push(model);
    }
  }
  return mergedModels;
}
