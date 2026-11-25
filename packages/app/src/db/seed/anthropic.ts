import type { NewModel } from '../schema';
import { NO_LONG_CONTEXT, anthropicCache, anthropicCache2_5Percent } from './helpers.ts';

export const ANTHROPIC_MODELS: NewModel[] = [
  // Anthropic (Claude) — 经 CF AI Gateway BYOK（ANTHROPIC_API_KEY 自付，不经 CF Unified Billing）；
  // upstreamModelId 用 Anthropic 规范连字符 ID（已 smoke 实测 CF 原生端点可用）。markupRate 1：按原厂价直通，不加价。
  // Claude Fable 5.2（2026-11-09 发布）：Mythos 级底座、超难数学与科学突破、长程 Agent 协同（1000+ 子 Agent 8 天）。
  // 输出速度提升 30%，基础 input $8 / output $40（较 5.1 降 20%）；prompt caching 读单价 $0.20/1M（2.5%），写单价 $10.00/1M（1.25× input）。
  {
    id: 'claude-fable-5-2',
    provider: 'anthropic',
    upstreamModelId: 'claude-fable-5-2',
    inputPrice: 8,
    outputPrice: 40,
    markupRate: 1,
    ...anthropicCache2_5Percent(8),
    ...NO_LONG_CONTEXT,
  },
  // Claude Fable 5.1（2026-09-01 发布）：Mythos 级底座，基础 input $10 / output $50；
  // prompt caching 读单价 $0.25/1M（相比 Fable 5 降价 75%），写单价 $12.50/1M（1.25× input）。
  {
    id: 'claude-fable-5-1',
    provider: 'anthropic',
    upstreamModelId: 'claude-fable-5-1',
    inputPrice: 10,
    outputPrice: 50,
    markupRate: 1,
    cachedInputPrice: 0.25,
    cacheWritePrice: 12.5,
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  // Claude Sonnet 5.5（2026-09-28 发布）：30%+ 速度飞升，任务成本降 30%
  // 官方定价：input $2 / output $10，写 $2.50/1M（1.25×）；
  // 2026-10-07 伴随 Haiku 5.5 发布，缓存读单价降价 50% 至 $0.10/1M（5%）
  {
    id: 'claude-sonnet-5-5',
    provider: 'anthropic',
    upstreamModelId: 'claude-sonnet-5-5',
    inputPrice: 2,
    outputPrice: 10,
    markupRate: 1,
    cachedInputPrice: 0.1,
    cacheWritePrice: 2.5,
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  {
    id: 'claude-sonnet-5',
    provider: 'anthropic',
    upstreamModelId: 'claude-sonnet-5',
    inputPrice: 3,
    outputPrice: 15,
    markupRate: 1,
    ...anthropicCache(3),
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  // Claude Opus 5.5（2026-09-22 发布）：Claude 5.5 先锋，运行成本较 Opus 5 降 40%
  // 官方定价：input $4 / output $20，prompt caching 读单价 $0.20/1M（5%），写单价 $5.00/1M（1.25× input）
  {
    id: 'claude-opus-5-5',
    provider: 'anthropic',
    upstreamModelId: 'claude-opus-5-5',
    inputPrice: 4,
    outputPrice: 20,
    markupRate: 1,
    cachedInputPrice: 0.2,
    cacheWritePrice: 5,
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  {
    id: 'claude-opus-5',
    provider: 'anthropic',
    upstreamModelId: 'claude-opus-5',
    inputPrice: 5,
    outputPrice: 25,
    markupRate: 1,
    ...anthropicCache(5),
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  // Claude Haiku 5.5（2026-10-07 发布）：高通量、低延迟小模型，支持 Effort 调节，1M 上下文
  // 官方阶梯定价：
  // <= 100K tokens: input $0.10 / output $0.50，缓存读 $0.01/1M（10%），写 $0.125/1M（1.25×）
  // > 100K tokens: input $0.50 / output $2.50，缓存读 $0.05/1M（10%），写 $0.625/1M（1.25×）
  {
    id: 'claude-haiku-5-5',
    provider: 'anthropic',
    upstreamModelId: 'claude-haiku-5-5',
    inputPrice: 0.1,
    outputPrice: 0.5,
    markupRate: 1,
    cachedInputPrice: 0.01,
    cacheWritePrice: 0.125,
    longContextThresholdTokens: 100_000,
    longContextInputPrice: 0.5,
    longContextCachedInputPrice: 0.05,
    longContextCacheWritePrice: 0.625,
    longContextOutputPrice: 2.5,
  },
];
