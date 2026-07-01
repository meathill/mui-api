# WIP — Claude Fable 5 下线（进行中）

## 已完成（代码）

- **移除 `claude-fable-5`**：`packages/app/src/db/seed.ts` 删除该条目；首页营销卡片 `models-section.tsx` 已同步移除（随 Sonnet 5 上架一起压平提交）。
- **重新生成 `packages/dashboard/seed-models.sql`**：`node packages/app/scripts/print-seed-sql.ts`，并手写追加 `DELETE FROM models WHERE id = 'claude-fable-5';`——现有生成脚本只做 `INSERT OR REPLACE`，不会自动清理已从 seed.ts 移除的条目，必须手动补删除语句。
- 已确认安全性：`models` 表无外键约束，`usageLogs` / `usageStats` 按 `model_id` 字符串过滤、不 JOIN `models` 表，删除该模型不影响历史用量记录的可查询性。
- 博客文章 `blog/claude-fable-5` 保留作为历史存档，不再从首页导流，无需处理。

## 待你执行（涉及 .env / 远程，按 CLAUDE.md 由你跑）

```bash
# 1) 应用到远程 D1（先 DELETE 旧模型，再 upsert 现有模型；database_name: mui-api）
wrangler d1 execute mui-api --remote --file=packages/dashboard/seed-models.sql

# 2) 清模型目录 KV 缓存（否则旧目录兜底 ~60s）
wrangler kv key delete --binding=KV models:catalog

# 3) smoke 确认其余模型未受影响（换成任意仍在售的模型）
CF_AIG_TOKEN=… CF_TOKEN=… MODEL=claude-sonnet-5 node packages/app/scripts/smoke-claude-unified.ts
```

## 后续

- 验收（远程目录已不含 Fable 5 + smoke 通过）后：可将本节归档删除。
