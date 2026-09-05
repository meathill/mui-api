# WIP

## 紧急：claude-sonnet-5 限时价已逾期未调（计费倒挂）

- 官方限时价 $2/$10 于 2026-08-31 截止，标准价 $3/$15；DEV_NOTE 待办逾期未执行，生产 D1 极可能仍按限时价对外结算（seed.ts 已在本轮维护中改为标准价）
- 执行 `scripts/update-claude-sonnet-5-price.sql`（含 KV 缓存清理与校验语句），执行后删掉该脚本

## 进行中（已停靠 feat-union 分支，2026-09-05 维护轮次）

- **GA4 关键事件（issue #13）**：代码已完成，停靠 feat-union（提交 c95331e）。合入部署后按 `docs/ga4-key-events.md` 做 DebugView 验证与后台关键事件标记。
- **AI 自主接入控制面**：未完成，停靠 feat-union（提交 18d14db，任务清单见该提交的 WIP.md）。恢复开发：`git rebase --onto master fab78f8 feat-union`。
- ⚠️ 合并前需重命名 feat-union 的 `packages/shared-db/drizzle/0028_integration_control.sql` → `0029_*`：master 已有 `0028_add_terms_consent.sql`，撞号会破坏迁移顺序。

## 待办：grok-4.6 / deepseek-v4-pro 博客发布（线上 404 已确认）

- 8 语种 MDX 与 `blog-content.ts` loader 均已入库，但 D1 `blog_post_translations` 元数据从未插入，`/blog/grok-4-6` 与 `/blog/deepseek-v4-pro` 线上 404（2026-09-05 实测）
- 元数据 SQL 可从历史恢复（模型段已上线，只需博客段）：`git show bcbb0e0:scripts/insert-grok-4-6-deepseek-v4-pro.sql > scripts/publish-grok-deepseek-blog.sql`，执行 `wrangler d1 execute mui-api --remote --file=scripts/publish-grok-deepseek-blog.sql` 后按需清 KV
- 发布后跑 `pnpm --dir packages/dashboard run submit:indexnow -- --dry-run` 确认 16 个新 URL 再正式提交
