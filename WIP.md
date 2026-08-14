# WIP

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
