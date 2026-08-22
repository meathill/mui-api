# WIP

## GPT-5.6 Sol 限时降价跟进与博客发布（2026-08-22）

### 模型与定价
- [x] 修改 `packages/app/src/db/seed.ts` 中 `gpt-5.6-sol` / `gpt-5.6` 价格（4/20/0.4/5.0）以及核对 `gpt-5.6-terra` / `gpt-5.6-luna`
- [x] 同步 `seed-models.sql` / `packages/dashboard/seed-models.sql`
- [x] 生成并执行一次性 SQL 脚本 `scripts/update-gpt-5-6-sol-price-and-post.sql`（已执行写入远程 D1）
- [x] 已清除远程 KV `models:catalog` 缓存
- [x] 一次性 SQL 脚本已清理删除
- [x] 工作流已沉淀为项目 Skill：`.agents/skills/model-pricing-and-announcement/SKILL.md`

### 博客
- [x] 中文文章 `packages/dashboard/src/content/blog/gpt-5-6-sol-price-cut.zh.mdx`
- [x] 在 `packages/dashboard/src/lib/blog-content.ts` 中注册 `gpt-5-6-sol-price-cut` loader
- [x] 已完成其余 7 种语言翻译（en, fr, es, pt, de, th, ja）并写入对应 MDX
- [x] 8 种语言的 `blog_post_translations` 元数据已全部同步至远程 D1 数据库

## grok-4.6 / deepseek-v4-pro 接入

### 模型（已上线 2026-08-13）

- [x] 已执行 `wrangler d1 execute mui-api --remote --file=scripts/insert-grok-4-6-deepseek-v4-pro-models.sql`
- [x] 已清除 KV `models:catalog` 缓存（下次有效请求自动回源重建）
- [ ] 用有效 API Key 请求 `GET /v1/models` 确认返回 `grok-4.6` / `deepseek-v4-pro`

### 博客（未发布，grok-4-6 与 deepseek-v4-pro 各一篇）

- [ ] 发布时执行完整版 `scripts/insert-grok-4-6-deepseek-v4-pro.sql`（含两篇博客、各 8 语种元数据）
- [ ] 推送部署后跑 `pnpm --dir packages/dashboard run submit:indexnow -- --dry-run` 确认新 URL（`/blog/grok-4-6`、`/blog/deepseek-v4-pro` 各 8 语言）再正式提交

## 部署后验证（未部署，待推送后执行）

- [ ] 推送部署后跑 `pnpm --dir packages/dashboard run submit:indexnow -- --dry-run` 确认新 URL 再正式提交（issue #9）
- [ ] 线上验证 MCP 双 era：curl modern `server/discover`（MCP-Protocol-Version: 2026-07-28 头 + `_meta`）、legacy `initialize`、`GET /mcp` 应 405
- [ ] 用 Claude Code / Cursor 实测 MCP 接入仍可用（legacy 路径回归）
