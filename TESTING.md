# 测试指南

## 目标

本仓库包含三个 workspace：

- `packages/app`：API Worker
- `packages/dashboard`：管理后台
- `packages/shared-db`：共享 D1 schema / migration

维护或开发时，优先运行与改动直接相关的测试，再补充全局检查。

## 环境要求

- Node.js `>= 24`
- `pnpm`
- 首次进入仓库后执行 `pnpm install`

## 常用命令

### 根目录

```bash
pnpm run typecheck
pnpm run format
```

### API Worker

```bash
pnpm --dir packages/app run test
pnpm --dir packages/app run test:e2e
pnpm --dir packages/app run build
```

- 单元测试使用 `vitest`，匹配 `src/**/*.test.ts`
- API E2E 也使用 `vitest`，配置文件为 `packages/app/vitest.e2e.config.ts`
- E2E 所需的测试 bindings 已在配置文件中提供，通常不需要读取本地 secrets

### Dashboard

```bash
pnpm --dir packages/dashboard run test
pnpm --dir packages/dashboard run test:e2e
pnpm --dir packages/dashboard run build
```

- 单元测试使用 `vitest`，匹配 `src/**/*.test.ts`
- E2E 使用 `playwright`
- 运行 dashboard E2E 前，先执行：

```bash
pnpm --dir packages/dashboard run test:e2e:prepare
pnpm --dir packages/dashboard run test:e2e
```

`test:e2e:prepare` 会在 `.wrangler/e2e-state` 的隔离 D1 中应用 migration，再写入 dashboard E2E 专用的最小模型 fixture，避免污染日常本地数据或依赖生产模型目录。

## 推荐顺序

### 改动 `packages/app`

```bash
pnpm --dir packages/app run test
pnpm run typecheck
pnpm --dir packages/app run build
```

### 改动 `packages/dashboard`

```bash
pnpm --dir packages/dashboard run test
pnpm run typecheck
pnpm --dir packages/dashboard run build
```

### 改动共享 schema / migration / 跨包逻辑

```bash
pnpm --dir packages/app run test
pnpm --dir packages/dashboard run test
pnpm run typecheck
pnpm --dir packages/app run build
pnpm --dir packages/dashboard run build
```

## CI 对齐

当前 CI 主要执行以下检查：

- `pnpm biome check --formatter-enabled=true --linter-enabled=false --assist-enabled=false`
- `pnpm --filter mui-api run test`
- `pnpm --filter mui-api run test:e2e`
- `pnpm --filter mui-api-dashboard exec playwright install chromium --with-deps`
- `pnpm --filter mui-api-dashboard run test:e2e:prepare`
- `pnpm --filter mui-api-dashboard run test:e2e`

本地维护时，建议额外执行 `pnpm run typecheck`，因为它目前不在 CI 中单独覆盖。

## 注意事项

- 不要读取仓库内的 `.env` / `.dev.vars` 作为维护前提；如果确实需要真实环境数据，优先编写脚本交给人工执行
- `packages/app` 与 `packages/dashboard` 本地开发时共用仓库根目录的 `.wrangler/state/v3`
- 自动化测试使用隔离环境，不应依赖这份本地共享状态
- `packages/app` E2E（vitest-pool-workers，用 `SELF.fetch` 打被测 Worker）里 mock 外部 HTTP 要用 `vi.stubGlobal('fetch', mock)` + `afterEach(vi.unstubAllGlobals)`，`vi.mock('模块名')` 无法拦截被测 Worker 的模块图（如 `resend`）。断言 `waitUntil` 里的副作用用 `vi.waitFor(...)`。E2E 不应发起真实外网请求（会受代理影响偶发超时）
