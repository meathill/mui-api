/**
 * 模型种子数据
 * 用法：通过 wrangler d1 execute 执行 SQL，或在管理后台手动添加
 *
 * 定价基于 2026 年 5 月各 Provider 官方定价（$/1M tokens）。
 *
 * 字段说明：
 *  - cachedInputPrice：cache 命中折扣价。多数 provider 为基础 input 的 ~10%
 *  - cacheWritePrice：cache 写入加价（仅 anthropic，1.25× 基础 input）
 *  - longContextThresholdTokens：触发长上下文档位的输入总量阈值（含 cache）
 *  - longContext*Price：跨阈值后启用的整套替换价
 *
 * 注意：手动 INSERT 后需要清除 KV 缓存（key: models:catalog），
 * 否则首次 LLM 请求才会触发 ModelCatalogService 回源 D1 拉新价。
 */

import type { NewModel } from './schema';

const NO_CACHE_NO_TIER = {
  cachedInputPrice: null,
  cacheWritePrice: null,
  longContextThresholdTokens: null,
  longContextInputPrice: null,
  longContextCachedInputPrice: null,
  longContextCacheWritePrice: null,
  longContextOutputPrice: null,
} as const;

/** openai 系：cache 命中 ~10% input */
function openaiCache(inputPrice: number) {
  return {
    cachedInputPrice: round(inputPrice * 0.1),
    cacheWritePrice: null,
  };
}

/** anthropic：cache_read ~10% input、cache_creation ~125% input */
function anthropicCache(inputPrice: number) {
  return {
    cachedInputPrice: round(inputPrice * 0.1),
    cacheWritePrice: round(inputPrice * 1.25),
  };
}

/** gemini：cache 命中 ~25% input（保守取值，官方按模型而异） */
function geminiCache(inputPrice: number) {
  return {
    cachedInputPrice: round(inputPrice * 0.25),
    cacheWritePrice: null,
  };
}

function round(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

export const SEED_MODELS: NewModel[] = [
  // OpenAI
  {
    id: 'gpt-5',
    provider: 'openai',
    upstreamModelId: 'gpt-5',
    inputPrice: 1.25,
    outputPrice: 10,
    markupRate: 1.2,
    ...openaiCache(1.25),
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  {
    id: 'gpt-5-mini',
    provider: 'openai',
    upstreamModelId: 'gpt-5-mini',
    inputPrice: 0.25,
    outputPrice: 2,
    markupRate: 1.2,
    ...openaiCache(0.25),
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  {
    id: 'gpt-5-nano',
    provider: 'openai',
    upstreamModelId: 'gpt-5-nano',
    inputPrice: 0.05,
    outputPrice: 0.4,
    markupRate: 1.2,
    ...openaiCache(0.05),
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  {
    id: 'gpt-4.1',
    provider: 'openai',
    upstreamModelId: 'gpt-4.1',
    inputPrice: 2,
    outputPrice: 8,
    markupRate: 1.2,
    ...openaiCache(2),
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  {
    id: 'gpt-4o',
    provider: 'openai',
    upstreamModelId: 'gpt-4o',
    inputPrice: 2.5,
    outputPrice: 10,
    markupRate: 1.2,
    ...openaiCache(2.5),
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  {
    id: 'gpt-4o-mini',
    provider: 'openai',
    upstreamModelId: 'gpt-4o-mini',
    inputPrice: 0.15,
    outputPrice: 0.6,
    markupRate: 1.2,
    ...openaiCache(0.15),
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
    markupRate: 1.2,
    ...NO_CACHE_NO_TIER,
  },

  // Google AI Studio (Gemini)
  // Gemini 2.5 Pro：官方定价 <=200K 与 >200K 两档（input 1.25/2.5，output 10/15）
  {
    id: 'gemini-2.5-pro',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-2.5-pro',
    inputPrice: 1.25,
    outputPrice: 10,
    markupRate: 1.2,
    ...geminiCache(1.25),
    longContextThresholdTokens: 200_000,
    longContextInputPrice: 2.5,
    longContextCachedInputPrice: round(2.5 * 0.25),
    longContextCacheWritePrice: null,
    longContextOutputPrice: 15,
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-2.5-flash',
    inputPrice: 0.3,
    outputPrice: 2.5,
    markupRate: 1.2,
    ...geminiCache(0.3),
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  {
    id: 'gemini-2.5-flash-lite',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-2.5-flash-lite',
    inputPrice: 0.1,
    outputPrice: 0.4,
    markupRate: 1.2,
    ...geminiCache(0.1),
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  {
    id: 'gemini-3-flash',
    provider: 'google-ai-studio',
    upstreamModelId: 'gemini-3-flash-preview',
    inputPrice: 0.5,
    outputPrice: 3,
    markupRate: 1.2,
    ...geminiCache(0.5),
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },

  // Anthropic (Claude) — 经 CF AI Gateway BYOK（ANTHROPIC_API_KEY 自付，不经 CF Unified Billing）；
  // upstreamModelId 用 Anthropic 规范连字符 ID（已 smoke 实测 CF 原生端点可用）。markupRate 1.05：BYOK 下不再有 CF 5% 充值费，只需覆盖 Stripe 手续费。
  {
    id: 'claude-sonnet-5',
    provider: 'anthropic',
    upstreamModelId: 'claude-sonnet-5',
    inputPrice: 2,
    outputPrice: 10,
    markupRate: 1.05,
    ...anthropicCache(2),
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  {
    id: 'claude-opus-4-8',
    provider: 'anthropic',
    upstreamModelId: 'claude-opus-4-8',
    inputPrice: 5,
    outputPrice: 25,
    markupRate: 1.05,
    ...anthropicCache(5),
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  {
    id: 'claude-opus-4-7',
    provider: 'anthropic',
    upstreamModelId: 'claude-opus-4-7',
    inputPrice: 5,
    outputPrice: 25,
    markupRate: 1.05,
    ...anthropicCache(5),
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  {
    id: 'claude-opus-4-6',
    provider: 'anthropic',
    upstreamModelId: 'claude-opus-4-6',
    inputPrice: 5,
    outputPrice: 25,
    markupRate: 1.05,
    ...anthropicCache(5),
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  {
    id: 'claude-sonnet-4-6',
    provider: 'anthropic',
    upstreamModelId: 'claude-sonnet-4-6',
    inputPrice: 3,
    outputPrice: 15,
    markupRate: 1.05,
    ...anthropicCache(3),
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },
  {
    id: 'claude-haiku-4-5',
    provider: 'anthropic',
    upstreamModelId: 'claude-haiku-4-5',
    inputPrice: 1,
    outputPrice: 5,
    markupRate: 1.05,
    ...anthropicCache(1),
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
  },

  // xAI Grok — 经 CF AI Gateway 转发，xAI key 以 Stored Keys 形式配置在网关侧，本服务不持有真实 key。
  // markupRate 1.05：走 Stored Keys 自付，无额外代付费，扣除 Stripe 手续费后不亏（与 Claude BYOK 同一口径）。
  // ⚠️ inputPrice/outputPrice 来自网络检索，未逐条核对 x.ai 官方定价页，需人工审核。
  // ⚠️ 未确认 Grok 是否支持 prompt caching，保守不给折扣价（NO_CACHE_NO_TIER）。
  // ⚠️ grok-imagine-image：官方未公开定价、未确认响应是否带 usage token；outputPrice 按
  //    「单价(USD) × 1,000,000」换算复用现有 token 计费公式，上线后需跑一次真实调用核实响应形状。
  {
    id: 'grok-4.3',
    provider: 'grok',
    upstreamModelId: 'grok-4.3',
    inputPrice: 1.25,
    outputPrice: 2.5,
    markupRate: 1.05,
    ...NO_CACHE_NO_TIER,
  },
  {
    id: 'grok-4.5',
    provider: 'grok',
    upstreamModelId: 'grok-4.5',
    inputPrice: 2,
    outputPrice: 6,
    markupRate: 1.05,
    ...NO_CACHE_NO_TIER,
  },
  {
    id: 'grok-imagine-image',
    provider: 'grok',
    upstreamModelId: 'grok-imagine-image',
    inputPrice: 0,
    outputPrice: 20_000, // 占位：假设 $0.02/张，待审核
    markupRate: 1.05,
    ...NO_CACHE_NO_TIER,
  },

  // Cloudflare Workers AI
  {
    id: 'glm-4.7-flash',
    provider: 'workers-ai',
    upstreamModelId: '@cf/zai-org/glm-4.7-flash',
    inputPrice: 0.06,
    outputPrice: 0.4,
    markupRate: 1.2,
    ...NO_CACHE_NO_TIER,
  },
  {
    id: 'qwen3-30b',
    provider: 'workers-ai',
    upstreamModelId: '@cf/qwen/qwen3-30b-a3b-fp8',
    inputPrice: 0.051,
    outputPrice: 0.335,
    markupRate: 1.2,
    ...NO_CACHE_NO_TIER,
  },
  {
    id: 'kimi-k2.6',
    provider: 'workers-ai',
    upstreamModelId: '@cf/moonshotai/kimi-k2.6',
    inputPrice: 0.95,
    outputPrice: 4,
    markupRate: 1.2,
    ...NO_CACHE_NO_TIER,
  },

  // Xiaomi MiMo —— 直连 OpenAI 兼容接口
  // 文本模型官方分 <=256K 与 >256K 两档；cache 命中按 OpenAI 兼容约 10%
  {
    id: 'mimo-v2.5-pro',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2.5-pro',
    inputPrice: 1,
    outputPrice: 3,
    markupRate: 1.2,
    ...openaiCache(1),
    longContextThresholdTokens: 256_000,
    longContextInputPrice: 2,
    longContextCachedInputPrice: round(2 * 0.1),
    longContextCacheWritePrice: null,
    longContextOutputPrice: 6,
  },
  {
    id: 'mimo-v2-pro',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2-pro',
    inputPrice: 1,
    outputPrice: 3,
    markupRate: 1.2,
    ...openaiCache(1),
    longContextThresholdTokens: 256_000,
    longContextInputPrice: 2,
    longContextCachedInputPrice: round(2 * 0.1),
    longContextCacheWritePrice: null,
    longContextOutputPrice: 6,
  },
  {
    id: 'mimo-v2.5',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2.5',
    inputPrice: 0.4,
    outputPrice: 2,
    markupRate: 1.2,
    ...openaiCache(0.4),
    longContextThresholdTokens: 256_000,
    longContextInputPrice: 0.8,
    longContextCachedInputPrice: round(0.8 * 0.1),
    longContextCacheWritePrice: null,
    longContextOutputPrice: 4,
  },
  {
    id: 'mimo-v2-omni',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2-omni',
    inputPrice: 0.4,
    outputPrice: 2,
    markupRate: 1.2,
    ...openaiCache(0.4),
    longContextThresholdTokens: 256_000,
    longContextInputPrice: 0.8,
    longContextCachedInputPrice: round(0.8 * 0.1),
    longContextCacheWritePrice: null,
    longContextOutputPrice: 4,
  },
  {
    id: 'mimo-v2.5-flash',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2.5-flash',
    inputPrice: 0.1,
    outputPrice: 0.3,
    markupRate: 1.2,
    ...openaiCache(0.1),
    longContextThresholdTokens: 256_000,
    longContextInputPrice: 0.2,
    longContextCachedInputPrice: round(0.2 * 0.1),
    longContextCacheWritePrice: null,
    longContextOutputPrice: 0.6,
  },

  // MiMo TTS 系列官方当前为限时免费；保留 0 价格，待官方收费后再更新。
  {
    id: 'mimo-v2.5-tts',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2.5-tts',
    inputPrice: 0,
    outputPrice: 0,
    markupRate: 1.2,
    ...NO_CACHE_NO_TIER,
  },
  {
    id: 'mimo-v2.5-tts-voiceclone',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2.5-tts-voiceclone',
    inputPrice: 0,
    outputPrice: 0,
    markupRate: 1.2,
    ...NO_CACHE_NO_TIER,
  },
  {
    id: 'mimo-v2.5-tts-voicedesign',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2.5-tts-voicedesign',
    inputPrice: 0,
    outputPrice: 0,
    markupRate: 1.2,
    ...NO_CACHE_NO_TIER,
  },
  {
    id: 'mimo-v2-tts',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2-tts',
    inputPrice: 0,
    outputPrice: 0,
    markupRate: 1.2,
    ...NO_CACHE_NO_TIER,
  },
];

/**
 * 生成 SQL INSERT 语句，可直接用 wrangler d1 execute 执行。
 *
 * 执行后请清除 KV `models:catalog` 缓存，否则旧价格还会兜底约 60s：
 *   wrangler kv key delete --binding=KV models:catalog
 */
export function generateSeedSQL(): string {
  const cols = [
    'id',
    'provider',
    'upstream_model_id',
    'input_price',
    'output_price',
    'markup_rate',
    'cached_input_price',
    'cache_write_price',
    'long_context_threshold_tokens',
    'long_context_input_price',
    'long_context_cached_input_price',
    'long_context_cache_write_price',
    'long_context_output_price',
  ];

  const values = SEED_MODELS.map((m) =>
    [
      `'${m.id}'`,
      `'${m.provider}'`,
      `'${m.upstreamModelId}'`,
      m.inputPrice,
      m.outputPrice,
      m.markupRate,
      nullable(m.cachedInputPrice),
      nullable(m.cacheWritePrice),
      nullable(m.longContextThresholdTokens),
      nullable(m.longContextInputPrice),
      nullable(m.longContextCachedInputPrice),
      nullable(m.longContextCacheWritePrice),
      nullable(m.longContextOutputPrice),
    ].join(', '),
  )
    .map((row) => `  (${row})`)
    .join(',\n');

  return `INSERT OR REPLACE INTO models (${cols.join(', ')}) VALUES\n${values};`;
}

function nullable(v: number | null | undefined): string {
  return v == null ? 'NULL' : String(v);
}
