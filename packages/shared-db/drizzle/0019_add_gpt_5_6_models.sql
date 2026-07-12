-- OpenAI GPT-5.6 家族：Sol / Terra / Luna + 短名 alias gpt-5.6（路由到 Sol）。
-- 官方 list price $/1M tokens；cache read = 10% input，cache write = 1.25× input。
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
  ('gpt-5.6-sol', 'openai', 'gpt-5.6-sol', 5, 30, 1.2, 0.5, 6.25, NULL, NULL, NULL, NULL, NULL),
  ('gpt-5.6', 'openai', 'gpt-5.6', 5, 30, 1.2, 0.5, 6.25, NULL, NULL, NULL, NULL, NULL),
  ('gpt-5.6-terra', 'openai', 'gpt-5.6-terra', 2.5, 15, 1.2, 0.25, 3.125, NULL, NULL, NULL, NULL, NULL),
  ('gpt-5.6-luna', 'openai', 'gpt-5.6-luna', 1, 6, 1.2, 0.1, 1.25, NULL, NULL, NULL, NULL, NULL);
