import type { NewModel } from '../schema';
import { NO_LONG_CONTEXT } from './helpers.ts';

export const MOONSHOT_MODELS: NewModel[] = [
  // Moonshot AI —— Kimi K3 直连官方 OpenAI 兼容接口；1M context 统一定价
  {
    id: 'kimi-k3',
    provider: 'moonshot',
    upstreamModelId: 'kimi-k3',
    inputPrice: 3,
    outputPrice: 15,
    markupRate: 1,
    cachedInputPrice: 0.3,
    cacheWritePrice: null,
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  // Kimi K3.1 Pro（2026-10-23 发布）：2.8T MoE 3T 级开源权重，1M 原生上下文，代码/CAD/金融全面进阶，官方 API 降价 33%
  {
    id: 'kimi-k3.1-pro',
    provider: 'moonshot',
    upstreamModelId: 'kimi-k3.1-pro',
    inputPrice: 2,
    outputPrice: 10,
    markupRate: 1,
    cachedInputPrice: 0.2,
    cacheWritePrice: null,
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  // Kimi K3.1 Pro Highspeed：2-3x 响应速度，输入 $4/M、输出 $20/M
  {
    id: 'kimi-k3.1-pro-highspeed',
    provider: 'moonshot',
    upstreamModelId: 'kimi-k3.1-pro-highspeed',
    inputPrice: 4,
    outputPrice: 20,
    markupRate: 1,
    cachedInputPrice: 0.4,
    cacheWritePrice: null,
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  {
    id: 'kimi-k2.7-code',
    provider: 'moonshot',
    upstreamModelId: 'kimi-k2.7-code',
    inputPrice: 0.95,
    outputPrice: 4,
    markupRate: 1,
    cachedInputPrice: 0.19,
    cacheWritePrice: null,
    ...NO_LONG_CONTEXT,
  },
];
