# WIP

## Issue #8：Next 16.3、公共缓存与充值规则升级

- [x] Dashboard 依赖升级到当前最新版，保留 Worker Node 22 类型边界
- [x] ~~启用 Cache Components / Partial Prefetching~~ → **已回退**，在 workerd 上会让所有 request-time 渲染挂死，详见 DEV_NOTE.md
- [x] 公共 D1 内容改用 `unstable_cache` 天级缓存
- [x] 补齐 Breadcrumb、canonical、robots、JSON-LD 与 OG 缓存回归
- [x] 明确最低充值 $10，保持 $10 / $20 / $50 固定档位并强化服务端校验
- [x] 完成格式化、类型检查、单元测试、构建与 E2E
- [x] 分阶段提交并推送 master，完成 Cloudflare 部署与 CI 验证
- [ ] 采集线上 10 次热请求、D1/CPU 指标，完成 Rich Results/GSC 复核后关闭 Issue #8

## 500 事故收尾（2026-08-10）

- [x] 关闭 Cache Components，blog/pricing/详情/Dashboard/OAuth 全部恢复 200
- [x] 修掉同源的 soft 404 与「D1 出错返回 200 + 骨架屏」
- [x] 加 `scripts/check-render-modes.ts` 构建后守卫 + `e2e/public-pages.test.ts` 内容回归
- [x] IndexNow 已提交 224 条 URL（状态码 200）
- [ ] GSC「重新提交」sitemap 需在网页端手动点一次（MCP token 权限不足，403）
- [ ] 观察 96 条页面的重新收录与 GSC 覆盖率报告

## 部署后验证（未部署，待推送后执行）

- [ ] 推送部署后跑 `pnpm --dir packages/dashboard run submit:indexnow -- --dry-run` 确认新 URL 再正式提交（issue #9）
- [ ] 线上验证 MCP 双 era：curl modern `server/discover`（MCP-Protocol-Version: 2026-07-28 头 + `_meta`）、legacy `initialize`、`GET /mcp` 应 405
- [ ] 用 Claude Code / Cursor 实测 MCP 接入仍可用（legacy 路径回归）
