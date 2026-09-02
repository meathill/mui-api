# WIP

## Issue #10: 抢占 MCP Router 与 OpenRouter 替代词 SEO

### Actionable TODOs
- [x] Title & Meta 升级：首页 Title、Description、OG 及 Keywords 强化 MCP Router 与 OpenRouter 替代词，同步 8 语种本地化
- [x] /mcp 专题页升级：完善 MCP 协议支持说明（双 era）、多 Server 聚合路由及各客户端（Claude Code / Cursor / Claude Desktop / Cline）配置教程
- [x] 上线 /compare/openrouter 对比页：展示自托管、多提供商切换与私有化部署优势，更新 sitemap 与导航
- [x] 测试与质量保障：通过 `messages-parity`、`sitemap.test.ts`、`vitest`、`typecheck` 和 `format`


## Claude Fable 5.1 接入与文章发布（2026-09-02）

### 模型与定价（已上线）
- [x] 修改 `packages/app/src/db/seed.ts`：追加 `claude-fable-5-1`、`claude-fable-5.1` 与 `claude-fable-5`
- [x] 同步 `seed-models.sql` / `packages/dashboard/seed-models.sql`
- [x] 生成并执行一次性 SQL 脚本写入远程 D1 `models` 表（价格：10/50/0.25/12.5）
- [x] 清除远程 KV `models:catalog` 缓存
- [x] 一次性 SQL 脚本已清理删除

### 文章发布（已发布至 muicv-cms）
- [x] 用户审阅并确认中文解读文章草稿（已落本地 `docs/claude-fable-5-1.md` 并清理多余分割线）
- [x] 正式发布至 MuiCV Payload CMS（section: `product`，slug: `claude-fable-5-1-announcement`，id: 7）
- [x] 验证线上 API 可正常检索，状态为 `published`

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
