-- Dashboard E2E 专用模型数据：只验证定价页会展示 D1 中的公开 token 模型。
INSERT OR REPLACE INTO `models` (
  `id`,
  `provider`,
  `upstream_model_id`,
  `input_price`,
  `output_price`,
  `markup_rate`,
  `cached_input_price`
) VALUES
  ('e2e-openai-chat', 'openai', 'e2e-openai-chat', 1, 2, 1.2, NULL),
  ('e2e-gemini-chat', 'google-ai-studio', 'e2e-gemini-chat', 1, 2, 1.2, NULL),
  ('kimi-k3', 'moonshot', 'kimi-k3', 3, 15, 1.2, 0.3);
