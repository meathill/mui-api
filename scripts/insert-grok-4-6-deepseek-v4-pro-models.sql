-- 向 D1 插入 grok-4.6 / deepseek-v4-pro 模型（不含博客元数据，博客待发布时执行完整版）
-- 执行命令：
--   wrangler d1 execute mui-api --remote --file=scripts/insert-grok-4-6-deepseek-v4-pro-models.sql
-- 执行后请清除 KV catalog 缓存：
--   wrangler kv key delete --binding=KV --remote models:catalog
--
-- grok-4.6：xAI 官方 2026-08-12 发布，定价 $2/$6（与 grok-4.5 同价），无 prompt caching 折扣
-- （沿用 grok 系列 NO_CACHE_NO_TIER 口径）。markup 1.05：走 Stored Keys 自付，与 Claude BYOK 同口径。
-- deepseek-v4-pro：DeepSeek-V4-Pro-0813 正式版，官方 $0.435/$0.87，cache hit $0.003625。
-- 元数据来自 models.dev（xai/grok-4.6、deepseek/deepseek-v4-pro），deepseek 的 open_weights
-- 按 DeepSeek 官方开源事实修正为 true（models.dev 条目误标 false）。

INSERT OR REPLACE INTO models (
  id,
  provider,
  upstream_model_id,
  input_price,
  output_price,
  markup_rate,
  cached_input_price,
  display_name,
  context_length,
  max_output_tokens,
  metadata_json
) VALUES
  (
    'grok-4.6',
    'grok',
    'grok-4.6',
    2,
    6,
    1.05,
    NULL,
    'Grok 4.6',
    500000,
    500000,
    '{"description":"xAI''s frontier model for long-running agents, coding, knowledge work, and visual projects","family":"grok","attachment":true,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":false,"knowledge":"2026-02-01","releaseDate":"2026-08-12","lastUpdated":"2026-08-12","modalities":{"input":["text","image","pdf"],"output":["text"]}}'
  ),
  (
    'deepseek-v4-pro',
    'deepseek',
    'deepseek-v4-pro',
    0.435,
    0.87,
    1.2,
    0.003625,
    'DeepSeek V4 Pro',
    1000000,
    384000,
    '{"description":"DeepSeek V4 Pro snapshot with million-token context and support for thinking and non-thinking modes","family":"deepseek-v4","attachment":false,"reasoning":true,"toolCall":true,"temperature":true,"structuredOutput":true,"openWeights":true,"releaseDate":"2026-08-12","lastUpdated":"2026-08-12","modalities":{"input":["text"],"output":["text"]}}'
  );
