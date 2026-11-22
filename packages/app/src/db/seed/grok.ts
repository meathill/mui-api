import type { NewModel } from '../schema';
import { GROK_IMAGE_MODEL_IDS } from '@muirouter/shared-db/grok-image';
import { GROK_VIDEO_MODEL_IDS } from '@muirouter/shared-db/grok-video';
import { NO_CACHE_NO_TIER } from './helpers.ts';

export const GROK_MODELS: NewModel[] = [
  // xAI Grok — 经 CF AI Gateway 转发，xAI key 以 Stored Keys 形式配置在网关侧，本服务不持有真实 key。
  // 按原厂价直通，不加价；走 Stored Keys 自付。
  // 图片模型把 xAI 返回的美元 ticks 换算为内部 output token；outputPrice=1 表示 $1/1M 内部 tokens。
  // ⚠️ 未确认 Grok 是否支持 prompt caching，保守不给折扣价（NO_CACHE_NO_TIER）。
  {
    id: 'grok-4.3',
    provider: 'grok',
    upstreamModelId: 'grok-4.3',
    inputPrice: 1.25,
    outputPrice: 2.5,
    markupRate: 1,
    ...NO_CACHE_NO_TIER,
  },
  {
    id: 'grok-4.5',
    provider: 'grok',
    upstreamModelId: 'grok-4.5',
    inputPrice: 2,
    outputPrice: 6,
    markupRate: 1,
    ...NO_CACHE_NO_TIER,
  },
  {
    id: 'grok-4.6',
    provider: 'grok',
    upstreamModelId: 'grok-4.6',
    inputPrice: 2,
    outputPrice: 6,
    markupRate: 1,
    ...NO_CACHE_NO_TIER,
  },
  {
    id: 'grok-4.7',
    provider: 'grok',
    upstreamModelId: 'grok-4.7',
    inputPrice: 2,
    outputPrice: 6,
    markupRate: 1,
    cachedInputPrice: 0.5,
    cacheWritePrice: null,
    longContextThresholdTokens: 200_000,
    longContextInputPrice: 4,
    longContextCachedInputPrice: 1,
    longContextCacheWritePrice: null,
    longContextOutputPrice: 12,
  },
  ...GROK_IMAGE_MODEL_IDS.map((id) => ({
    id,
    provider: 'grok',
    upstreamModelId: id,
    inputPrice: 0,
    outputPrice: 1,
    markupRate: 1,
    ...NO_CACHE_NO_TIER,
  })),
  ...GROK_VIDEO_MODEL_IDS.map((id) => ({
    id,
    provider: 'grok',
    upstreamModelId: id,
    inputPrice: 0,
    outputPrice: 1,
    markupRate: 1,
    ...NO_CACHE_NO_TIER,
  })),
];
