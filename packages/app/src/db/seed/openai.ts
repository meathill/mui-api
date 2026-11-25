import type { NewModel } from '../schema';
import {
  NO_CACHE_NO_TIER,
  openaiCache,
  openaiCache5Percent,
  openaiCacheWithWrite,
  openaiLongContext,
  openaiLongContext5Percent,
} from './helpers.ts';

export const OPENAI_MODELS: NewModel[] = [
  // OpenAI
  // GPT-6.2 Astra（2026-11-17 发布）：新旗舰，标准输入/输出较 GPT-6 Astra 降价 20%（$8/$40），缓存读降 60% 至 $0.40（5%）
  // @see https://developers.openai.com/api/docs/models/gpt-6.2-astra
  {
    id: 'gpt-6.2-astra',
    provider: 'openai',
    upstreamModelId: 'gpt-6.2-astra',
    inputPrice: 8,
    outputPrice: 40,
    markupRate: 1,
    ...openaiCache5Percent(8),
    ...openaiLongContext5Percent(8, 40),
  },
  // GPT-6.2 Sol（2026-11-17 发布）：高效率主力模型，延续 $2/$10 定价与 5% 缓存读（$0.10/1M），输出 token 消耗显著降低
  // @see https://developers.openai.com/api/docs/models/gpt-6.2-sol
  {
    id: 'gpt-6.2-sol',
    provider: 'openai',
    upstreamModelId: 'gpt-6.2-sol',
    inputPrice: 2,
    outputPrice: 10,
    markupRate: 1,
    ...openaiCache5Percent(2),
    ...openaiLongContext5Percent(2, 10),
  },
  // 短名 alias：gpt-6.2
  {
    id: 'gpt-6.2',
    provider: 'openai',
    upstreamModelId: 'gpt-6.2-sol',
    inputPrice: 2,
    outputPrice: 10,
    markupRate: 1,
    ...openaiCache5Percent(2),
    ...openaiLongContext5Percent(2, 10),
  },
  // GPT-5.6：Sol / Terra / Luna（官方 list price $/1M tokens；cache write 1.25× input）
  {
    id: 'gpt-5.6-sol',
    provider: 'openai',
    upstreamModelId: 'gpt-5.6-sol',
    inputPrice: 4,
    outputPrice: 20,
    markupRate: 1,
    ...openaiCacheWithWrite(4),
    ...openaiLongContext(4, 20),
  },
  // 短名 alias → Sol（与 OpenAI API 一致）
  {
    id: 'gpt-5.6',
    provider: 'openai',
    upstreamModelId: 'gpt-5.6',
    inputPrice: 4,
    outputPrice: 20,
    markupRate: 1,
    ...openaiCacheWithWrite(4),
    ...openaiLongContext(4, 20),
  },
  {
    id: 'gpt-5.6-terra',
    provider: 'openai',
    upstreamModelId: 'gpt-5.6-terra',
    inputPrice: 2.0,
    outputPrice: 12.0,
    markupRate: 1,
    ...openaiCacheWithWrite(2.0),
    ...openaiLongContext(2, 12),
  },
  {
    id: 'gpt-5.6-luna',
    provider: 'openai',
    upstreamModelId: 'gpt-5.6-luna',
    inputPrice: 0.2,
    outputPrice: 1.2,
    markupRate: 1,
    ...openaiCacheWithWrite(0.2),
    ...openaiLongContext(0.2, 1.2),
  },
  // GPT-6 Astra：2026-09-04 发布的旗舰，官方仅此一个 id（无短别名）
  // @see https://openai.com/index/gpt-6-astra/
  {
    id: 'gpt-6-astra',
    provider: 'openai',
    upstreamModelId: 'gpt-6-astra',
    inputPrice: 10,
    outputPrice: 50,
    markupRate: 1,
    ...openaiCacheWithWrite(10),
    ...openaiLongContext(10, 50),
  },
  // GPT-6.1 Sol（2026-09-29 发布）：DevDay 2026 压轴，缓存读大砍 95%（$0.10/1M）
  // @see https://openai.com/index/gpt-6-1-sol/
  {
    id: 'gpt-6.1-sol',
    provider: 'openai',
    upstreamModelId: 'gpt-6.1-sol',
    inputPrice: 2,
    outputPrice: 10,
    markupRate: 1,
    ...openaiCache5Percent(2),
    ...openaiLongContext5Percent(2, 10),
  },
  // 短名 alias：gpt-6.1
  {
    id: 'gpt-6.1',
    provider: 'openai',
    upstreamModelId: 'gpt-6.1-sol',
    inputPrice: 2,
    outputPrice: 10,
    markupRate: 1,
    ...openaiCache5Percent(2),
    ...openaiLongContext5Percent(2, 10),
  },
  // GPT-6.1 Terra（2026-10-26 发布）：超高性价比，API 标准价格较 GPT-5.6 Terra 与 GPT-6.1 Sol 减半，专精视觉推断与 Computer Use
  // @see https://openai.com/index/gpt-6-1-terra/
  {
    id: 'gpt-6.1-terra',
    provider: 'openai',
    upstreamModelId: 'gpt-6.1-terra',
    inputPrice: 1,
    outputPrice: 5,
    markupRate: 1,
    ...openaiCache5Percent(1),
    ...openaiLongContext5Percent(1, 5),
  },
  // GPT-6 Sol / Luna（2026-09-22 发布）：较上一代 GPT-5.6 降价 50%，全线赋予 90% 缓存折扣
  // @see https://openai.com/api/pricing
  {
    id: 'gpt-6-sol',
    provider: 'openai',
    upstreamModelId: 'gpt-6-sol',
    inputPrice: 2,
    outputPrice: 10,
    markupRate: 1,
    ...openaiCacheWithWrite(2),
    ...openaiLongContext(2, 10),
  },
  // 短名 alias → Sol（与 OpenAI API 一致）
  {
    id: 'gpt-6',
    provider: 'openai',
    upstreamModelId: 'gpt-6-sol',
    inputPrice: 2,
    outputPrice: 10,
    markupRate: 1,
    ...openaiCacheWithWrite(2),
    ...openaiLongContext(2, 10),
  },
  {
    id: 'gpt-6-luna',
    provider: 'openai',
    upstreamModelId: 'gpt-6-luna',
    inputPrice: 0.1,
    outputPrice: 0.5,
    markupRate: 1,
    ...openaiCacheWithWrite(0.1),
    ...openaiLongContext(0.1, 0.5),
  },
  // gpt-4o 虽定于 2027-01-14 停服，但生产仍有活跃调用与示例依赖，暂保留；gpt-5 / gpt-5-mini / gpt-5-nano / gpt-4.1 / gpt-4o-mini 已退役清理
  {
    id: 'gpt-4o',
    provider: 'openai',
    upstreamModelId: 'gpt-4o',
    inputPrice: 2.5,
    outputPrice: 10,
    markupRate: 1,
    ...openaiCache(2.5),
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  {
    id: 'gpt-image-2',
    provider: 'openai',
    upstreamModelId: 'gpt-image-2',
    inputPrice: 8,
    outputPrice: 30,
    markupRate: 1,
    ...NO_CACHE_NO_TIER,
  },
];
