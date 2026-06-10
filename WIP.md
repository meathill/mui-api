# WIP — Claude Fable 5 上架 + 介绍博文

## 已完成（代码）

- **上架 `claude-fable-5`**：`packages/app/src/db/seed.ts` 新增条目（$10/$50、markup 1.1、`anthropicCache(10)`，列 Anthropic 块最前）；营销卡片 `models-section.tsx` 首位加 `Claude Fable 5`。
- **博文（en/zh）**：`content/blog/claude-fable-5.mdx` + `.zh.mdx`；`lib/blog.ts` 注册元数据（8 key，en/zh 真实、其余 6 英文占位）；新增路由 `blog/claude-fable-5/page.tsx`（en/zh 真实，fr/es/pt/de/th/ja 回退 en MDX）。
- 验证：`pnpm format` / `typecheck` 全绿；dashboard 23 + app 181 测试通过；`next build` 8 语言全部预渲染；dev 预览 `/zh/blog/claude-fable-5` 正常、无 console 报错。sitemap、`/blog` 列表自动收录（新文置顶）。

## 待你执行（涉及 .env / 远程，按 CLAUDE.md 由你跑）

> 前置：先 smoke 确认 CF Unified Billing 已支持 `claude-fable-5`（像当初 Opus 4.8 一样），A/B 腿应 HTTP 200，再对外开放。

```bash
# 1) 前置 smoke（真实少量 credits）—— A 原生 / B compat 应 200
CF_AIG_TOKEN=… CF_TOKEN=… MODEL=claude-fable-5 node packages/app/scripts/smoke-claude-unified.ts

# 2) 生成全量 upsert SQL（含 claude-fable-5）
node packages/app/scripts/print-seed-sql.ts > seed-models.sql

# 3) 应用到远程 D1（database_name: mui-api）
wrangler d1 execute mui-api --remote --file=seed-models.sql

# 4) 清模型目录 KV 缓存（否则旧目录兜底 ~60s）
wrangler kv key delete --binding=KV models:catalog
```

（或走 admin API `POST /api/admin/models` 单条新增，路由内部会自动 `modelCatalog.refresh()`。）

## 后续

- **6 语言博文补译**：fr/es/pt/de/th/ja 目前回退英文。补译时：①替换 `lib/blog.ts` 里这 6 个 locale 的 title/description/tags 与 source labels；②新增对应 `claude-fable-5.<locale>.mdx`；③把 `blog/claude-fable-5/page.tsx` 的 loader 由 `loadEn` 改成各自 import。
- 验收（smoke + 线上目录）通过后：把「上架模型 runbook」并入 `DEV_NOTE.md`，删除本 WIP.md。
- 可选：`messages/*.json` 的 `"Opus / Sonnet / Haiku public token prices"` 描述句未含 Fable，如需可 8 语言同步补。
