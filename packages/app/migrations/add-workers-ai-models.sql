-- Workers AI 首批 text 模型 + Claude upstream id 迁移（Bedrock → AI Gateway）
-- 执行：wrangler d1 execute <DB_NAME> --remote --file=packages/app/migrations/add-workers-ai-models.sql

-- Claude：upstream_model_id 从 Bedrock 跨区推理 ID 改为 Anthropic 官方 id
UPDATE models SET upstream_model_id = 'claude-opus-4-6'   WHERE id = 'claude-opus-4-6';
UPDATE models SET upstream_model_id = 'claude-sonnet-4-6' WHERE id = 'claude-sonnet-4-6';
UPDATE models SET upstream_model_id = 'claude-sonnet-4-5' WHERE id = 'claude-sonnet-4-5';
UPDATE models SET upstream_model_id = 'claude-haiku-4-5' WHERE id = 'claude-haiku-4-5';

-- Workers AI 新增
INSERT OR REPLACE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES
  ('glm-4.7-flash', 'workers-ai', '@cf/zai-org/glm-4.7-flash', 0.06, 0.4, 1.2),
  ('qwen3-30b',     'workers-ai', '@cf/qwen/qwen3-30b-a3b-fp8', 0.051, 0.335, 1.2),
  ('kimi-k2.6',     'workers-ai', '@cf/moonshotai/kimi-k2.6', 0.95, 4, 1.2);
