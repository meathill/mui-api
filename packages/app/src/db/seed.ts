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
import { ANTHROPIC_MODELS } from './seed/anthropic.ts';
import { GOOGLE_MODELS } from './seed/google.ts';
import { GROK_MODELS } from './seed/grok.ts';
import { MOONSHOT_MODELS } from './seed/moonshot.ts';
import { OPENAI_MODELS } from './seed/openai.ts';
import { OTHER_MODELS } from './seed/others.ts';
import { WORKERS_AI_MODELS } from './seed/workers-ai.ts';
import { XIAOMI_MIMO_MODELS } from './seed/xiaomi-mimo.ts';

/**
 * 全量模型种子数据，按 provider 分文件维护（src/db/seed/）：
 *  - openai.ts / google.ts / anthropic.ts / grok.ts / workers-ai.ts / moonshot.ts / xiaomi-mimo.ts
 *  - others.ts：deepseek / zai / longcat / minimax / meta / qwen / hy
 * 接入新模型时改对应 provider 文件；本文件只做聚合与 SQL 生成。
 */
export const SEED_MODELS: NewModel[] = [
  ...OPENAI_MODELS,
  ...GOOGLE_MODELS,
  ...ANTHROPIC_MODELS,
  ...GROK_MODELS,
  ...WORKERS_AI_MODELS,
  ...MOONSHOT_MODELS,
  ...OTHER_MODELS,
  ...XIAOMI_MIMO_MODELS,
];

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

  const updateCols = cols
    .filter((col) => col !== 'id')
    .map((col) => `  ${col} = excluded.${col}`)
    .join(',\n');

  return `INSERT INTO models (${cols.join(', ')}) VALUES\n${values}\nON CONFLICT(id) DO UPDATE SET\n${updateCols};`;
}

function nullable(v: number | null | undefined): string {
  return v == null ? 'NULL' : String(v);
}
