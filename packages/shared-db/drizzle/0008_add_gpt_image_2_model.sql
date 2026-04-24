-- 新增 OpenAI gpt-image-2 图片模型
-- 价格单位沿用 models 表现有口径：每 100 万 tokens 的 USD 价格。
-- 当前表结构无法区分 text/image input token 单价，这里先使用较保守的 image input 价格。
INSERT OR REPLACE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES
  ('gpt-image-2', 'openai', 'gpt-image-2', 8, 30, 1.2);
