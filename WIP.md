# WIP

## 部署后验证（未部署，待推送后执行）

- [ ] 推送部署后跑 `pnpm --dir packages/dashboard run submit:indexnow -- --dry-run` 确认新 URL 再正式提交（issue #9）
- [ ] 线上验证 MCP 双 era：curl modern `server/discover`（MCP-Protocol-Version: 2026-07-28 头 + `_meta`）、legacy `initialize`、`GET /mcp` 应 405
- [ ] 用 Claude Code / Cursor 实测 MCP 接入仍可用（legacy 路径回归）
