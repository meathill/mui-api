# MuiRouter

OpenAI 兼容的 AI / LLM / MCP 路由网关：一个 API Key 接入多家模型供应商，统一计费、配额与并发控制。线上站点 [muirouter.com](https://muirouter.com)。

## 这是什么

- **统一入口**：对外暴露 `/v1/*` 接口（chat / images / videos / models）与 MCP server，按模型把请求分发到 OpenAI、Google、Anthropic、Moonshot AI、Workers AI、Xiaomi MiMo 等供应商。
- **凭证集中**：调用方只持有本服务的 API Key（`sk-gw-` 前缀）或 OAuth 2.0 token；上游凭证由 CF AI Gateway Stored Keys 或 Worker secrets 托管。
- **计费与配额**：按 token 分档计费（标准 / 长上下文、cache 命中 / 写入），支持免费额度白名单、消费限额告警、Stripe 自助充值。

## 仓库结构

pnpm monorepo，三个 package 共享同一套 Cloudflare D1 / KV：

| 目录 | 角色 | 技术栈 |
|------|------|--------|
| [`packages/app`](packages/app/README.md) | API 网关（后端） | Cloudflare Workers · Hono · D1 · KV · Durable Object · Resend |
| [`packages/dashboard`](packages/dashboard/README.md) | 控制台 + 营销站（前端） | Next.js 16 · better-auth · Base UI · Tailwind 4 · next-intl |
| `packages/shared-db` | 共享 Drizzle schema 与 migration | Drizzle ORM · Cloudflare D1 |

## 快速开始

前置：Node.js ≥ 24、pnpm。

```bash
pnpm install
pnpm --dir packages/shared-db db:migrate:local   # 初始化本地 D1（首次）
pnpm --dir packages/app dev                       # 后端
pnpm --dir packages/dashboard dev                 # 控制台（http://localhost:3035）
```

本地开发务必让三个 package 指向仓库根目录同一份 `.wrangler/state/v3`，并关闭 remote bindings，避免误连远程数据。详见 [DEV_NOTE.md](DEV_NOTE.md)。

## 常用命令

```bash
pnpm run typecheck                       # 全 package 类型检查
pnpm run format                          # biome 格式化
pnpm --dir packages/app test             # 后端单元测试（vitest）
pnpm --dir packages/app test:e2e         # 后端 E2E（真实 D1，CF Workers pool）
pnpm --dir packages/dashboard test       # 前端单元测试（vitest）
```

部署见 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 文档

- [DEV_NOTE.md](DEV_NOTE.md) — 架构决策、计费定价矩阵、框架坑与约定
- [TESTING.md](TESTING.md) — 测试运行指南
- [DEPLOYMENT.md](DEPLOYMENT.md) — 部署流程
- [muirouter-spec.md](muirouter-spec.md) — 第三方接入规范（PAT / OAuth 2.0）
