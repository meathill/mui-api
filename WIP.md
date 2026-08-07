# WIP

## Issue #9：MCP Router/Gateway 关键词内容集群（2026-08-08）

- [ ] 新建教育型主题页 `/mcp-server`（page.tsx + 8 语言 `mcpServer` namespace）
- [ ] 强化 `/ai-router`：FAQ/intro 补 passthrough
- [ ] `/mcp-router` metaTitle/metaDescription 去竞争（去掉 "MCP Server" token）× 8
- [ ] related 互链：aiRouter / mcpRouter / mcpPage / openaiCompatibleRouter × 8
- [ ] pricing 页加相关链接区块（namespace × 8 + page.tsx）
- [ ] footer 加 MCP Server 链接
- [ ] sitemap.ts + sitemap.test.ts + e2e 断言更新
- [ ] format / typecheck / vitest / e2e 全部通过
- [ ] DEV_NOTE 记录、清理 WIP、提交

## MCP server 双 era 升级（2026-07-28 规范）

- [ ] `routes/mcp.ts` 重构：modern（stateless）+ legacy（initialize）双路径
- [ ] modern 路径：头校验 / server/discover / tools/list（ttlMs）/ resultType / 错误分支
- [ ] legacy 路径：initialize 版本协商
- [ ] GET → 405，删非标准 discovery
- [ ] e2e 扩展 + `/mcp` 页 protocolNote 更新（8 语言）
- [ ] DEV_NOTE 记录、提交
