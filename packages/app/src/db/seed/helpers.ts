/**
 * SEED_MODELS 各 provider 文件共用的定价 helpers。
 */

export const NO_CACHE_NO_TIER = {
  cachedInputPrice: null,
  cacheWritePrice: null,
  longContextThresholdTokens: null,
  longContextInputPrice: null,
  longContextCachedInputPrice: null,
  longContextCacheWritePrice: null,
  longContextOutputPrice: null,
} as const;

export const NO_LONG_CONTEXT = {
  longContextThresholdTokens: null,
  longContextInputPrice: null,
  longContextCachedInputPrice: null,
  longContextCacheWritePrice: null,
  longContextOutputPrice: null,
} as const;

/** openai 系：cache 命中 ~10% input */
export function openaiCache(inputPrice: number) {
  return {
    cachedInputPrice: round(inputPrice * 0.1),
    cacheWritePrice: null,
  };
}

/**
 * GPT-5.6 起：cache read 仍为 10% input；cache write 为 1.25× uncached input。
 * @see https://openai.com/index/gpt-5-6/
 */
export function openaiCacheWithWrite(inputPrice: number) {
  return {
    cachedInputPrice: round(inputPrice * 0.1),
    cacheWritePrice: round(inputPrice * 1.25),
  };
}

/**
 * GPT-5.6 起：超过 272K input tokens 的请求整单按长上下文档位计费，
 * input / 缓存 2×、output 1.5×。
 * @see https://developers.openai.com/api/docs/pricing
 */
export function openaiLongContext(inputPrice: number, outputPrice: number) {
  return {
    longContextThresholdTokens: 272_000,
    longContextInputPrice: round(inputPrice * 2),
    longContextCachedInputPrice: round(inputPrice * 2 * 0.1),
    longContextCacheWritePrice: round(inputPrice * 2 * 1.25),
    longContextOutputPrice: round(outputPrice * 1.5),
  };
}

/** GPT-6.1 Sol 起：cache read 深度折扣至 5% input（95% 优惠）；cache write 保持 1.25× uncached input */
export function openaiCache5Percent(inputPrice: number) {
  return {
    cachedInputPrice: round(inputPrice * 0.05),
    cacheWritePrice: round(inputPrice * 1.25),
  };
}

export function openaiLongContext5Percent(inputPrice: number, outputPrice: number) {
  return {
    longContextThresholdTokens: 272_000,
    longContextInputPrice: round(inputPrice * 2),
    longContextCachedInputPrice: round(inputPrice * 2 * 0.05),
    longContextCacheWritePrice: round(inputPrice * 2 * 1.25),
    longContextOutputPrice: round(outputPrice * 1.5),
  };
}

/** anthropic：cache_read ~10% input、cache_creation ~125% input */
export function anthropicCache(inputPrice: number) {
  return {
    cachedInputPrice: round(inputPrice * 0.1),
    cacheWritePrice: round(inputPrice * 1.25),
  };
}

/** anthropic Fable 5.1/5.2：cache_read 2.5% input、cache_creation ~125% input */
export function anthropicCache2_5Percent(inputPrice: number) {
  return {
    cachedInputPrice: round(inputPrice * 0.025),
    cacheWritePrice: round(inputPrice * 1.25),
  };
}

/** gemini：cache 命中 ~10% input（官方按模型而异，大部分为 10%，Argon 单独为 5%） */
export function geminiCache(inputPrice: number) {
  return {
    cachedInputPrice: round(inputPrice * 0.1),
    cacheWritePrice: null,
  };
}

export function round(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
