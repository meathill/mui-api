-- Grok 图片模型按 xAI 返回的美元 ticks 换算为内部 output token。
-- output_price = 1 表示每 100 万内部 token 收取 $1；markup_rate 仍单独应用。

INSERT OR REPLACE INTO models (
  id,
  provider,
  upstream_model_id,
  input_price,
  output_price,
  markup_rate,
  cached_input_price,
  cache_write_price,
  long_context_threshold_tokens,
  long_context_input_price,
  long_context_cached_input_price,
  long_context_cache_write_price,
  long_context_output_price
) VALUES
  ('grok-imagine-image', 'grok', 'grok-imagine-image', 0, 1, 1.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('grok-imagine-image-quality', 'grok', 'grok-imagine-image-quality', 0, 1, 1.05, NULL, NULL, NULL, NULL, NULL, NULL, NULL);
