-- Moonshot AI Kimi K3：1M context 统一定价；cache hit $0.30/M、cache miss $3/M、output $15/M。
-- 应用后请清除 KV models:catalog。

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
  ('kimi-k3', 'moonshot', 'kimi-k3', 3, 15, 1.2, 0.3, NULL, NULL, NULL, NULL, NULL, NULL);
