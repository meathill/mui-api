-- Claude Sonnet 5 限时价（$2/$10，官方 2026-08-31 截止）恢复标准价 $3/$15（与 claude-sonnet-4-6 同价）
-- 依据：DEV_NOTE.md「Claude Sonnet 5 限时定价」一节的待办，原定 2026-09-01 前执行，2026-09-05 维护轮次发现逾期未执行
-- cache 价沿用 anthropicCache 口径：cached = input × 0.1，write = input × 1.25
--
-- 执行命令（由有 wrangler 权限的人运行）：
--   wrangler d1 execute mui-api --remote --file=scripts/update-claude-sonnet-5-price.sql
-- 执行后清除 KV 模型目录缓存：
--   wrangler kv key delete --binding=KV --remote models:catalog
--
-- 注意：用 UPDATE 而非 INSERT OR REPLACE，避免覆盖 display_name / context_length / metadata_json 等既有列。

UPDATE models
SET input_price = 3,
    output_price = 15,
    cached_input_price = 0.3,
    cache_write_price = 3.75
WHERE id = 'claude-sonnet-5';

-- 校验（预期 3 / 15 / 0.3 / 3.75，只应影响 1 行）
SELECT id, input_price, output_price, cached_input_price, cache_write_price
FROM models
WHERE id = 'claude-sonnet-5';
