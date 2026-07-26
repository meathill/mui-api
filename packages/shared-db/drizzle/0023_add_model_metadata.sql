-- models 表补对外元数据：让客户端只填 endpoint + key 就能刷出模型列表。
--
-- 背景：opencode 之类的客户端不调 provider 的 /v1/models，它们的模型列表来自 models.dev
-- （开源 TOML 数据库，走 PR 收录）。MuiRouter 要进 models.dev 就得为每个模型提供 context
-- 长度、能力标记、模态、发布日期；而 Cherry Studio / LobeChat / Cline 这批**确实**调
-- /v1/models 的客户端也要同一份信息。两个出口共用这四列。
--
--   - display_name：展示名，如 'Claude Opus 5'
--   - context_length / max_output_tokens：上下文与单次输出上限（token）
--   - metadata_json：能力标记 / 模态 / 发布日期的 JSON blob，结构见
--     packages/shared-db/src/model-metadata.ts。之所以不逐列建模，是因为字段集合由
--     models.dev 的 schema 决定且仍在演进，逐列会让每次上游加字段都变成一次迁移。
--
-- 全部 nullable：存量模型迁移后为 null，不影响任何现有读路径；元数据由
-- packages/app/scripts/fetch-model-metadata.ts 生成的 0024 迁移回填。

ALTER TABLE models ADD COLUMN display_name TEXT;
ALTER TABLE models ADD COLUMN context_length INTEGER;
ALTER TABLE models ADD COLUMN max_output_tokens INTEGER;
ALTER TABLE models ADD COLUMN metadata_json TEXT;
