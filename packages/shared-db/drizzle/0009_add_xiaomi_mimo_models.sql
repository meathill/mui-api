-- 新增 Xiaomi MiMo 模型。
-- 价格单位沿用 models 表现有口径：每 100 万 tokens 的 USD 价格。
-- 当前表结构无法区分 cache hit、长上下文分档或夜间折扣，这里使用官方海外价的 cache miss、Input <= 256K 档位。
INSERT OR REPLACE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES
  ('mimo-v2.5-pro', 'xiaomi-mimo', 'mimo-v2.5-pro', 1, 3, 1.2),
  ('mimo-v2-pro', 'xiaomi-mimo', 'mimo-v2-pro', 1, 3, 1.2),
  ('mimo-v2.5', 'xiaomi-mimo', 'mimo-v2.5', 0.4, 2, 1.2),
  ('mimo-v2-omni', 'xiaomi-mimo', 'mimo-v2-omni', 0.4, 2, 1.2),
  ('mimo-v2.5-flash', 'xiaomi-mimo', 'mimo-v2.5-flash', 0.1, 0.3, 1.2);
