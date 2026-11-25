-- 清理仅 dot/hyphen 写法不同的重复模型行
--
-- 背景：这些行是历史遗留的"别名"条目（id 与 upstream_model_id 只差 . / -），
-- 与规范行并存，导致 Playground、定价页和 GET /v1/models 把同一模型显示两遍。
-- 解析层 ModelCatalogService.getById 已内置 dot/hyphen 归一化，别名请求无需落库。
--
-- 执行：
--   wrangler d1 execute mui-api --remote --file=packages/app/migrations/remove-dot-hyphen-alias-models.sql
--   wrangler kv key delete --binding=KV models:catalog   # 清目录缓存，否则旧列表继续生效

DELETE FROM models WHERE id IN (
  -- OpenAI：规范行为 dot 形式（如 gpt-6.2-sol）
  'gpt-6-2-astra',
  'gpt-6-2-sol',
  'gpt-6-1-sol',
  'gpt-6-1-terra',
  -- Google：规范行为 dot 形式（如 gemini-3.8-flash）
  'gemini-3-8-flash',
  'gemini-3-5-flash-lite',
  'gemini-3-1-pro-preview',
  'gemini-3-1-flash-lite',
  -- Anthropic：规范行为 hyphen 形式（如 claude-sonnet-5-5）
  'claude-fable-5.2',
  'claude-fable-5.1',
  'claude-sonnet-5.5',
  'claude-opus-5.5',
  'claude-haiku-5.5',
  -- Moonshot：规范行为 dot 形式（如 kimi-k3.1-pro）
  'kimi-k3-1-pro',
  'kimi-k3-1-pro-highspeed',
  -- DeepSeek：规范行为 dot 形式（如 deepseek-v4.1-flash）
  'deepseek-v4-1-flash',
  'deepseek-v4-1-flash-1017'
);

-- 校验：应返回 0 行
-- SELECT id FROM models WHERE id IN ('gpt-6-2-astra', 'gpt-6-2-sol', 'gpt-6-1-sol', 'gpt-6-1-terra',
--   'gemini-3-8-flash', 'gemini-3-5-flash-lite', 'gemini-3-1-pro-preview', 'gemini-3-1-flash-lite',
--   'claude-fable-5.2', 'claude-fable-5.1', 'claude-sonnet-5.5', 'claude-opus-5.5', 'claude-haiku-5.5',
--   'kimi-k3-1-pro', 'kimi-k3-1-pro-highspeed', 'deepseek-v4-1-flash', 'deepseek-v4-1-flash-1017');
