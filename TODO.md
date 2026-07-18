# TODO

长期待办，按发现时间倒序排列；开工前先读，避免与已评估过的事项重复盘点。

## 测试覆盖缺口（2026-07-18 维护轮次盘点，已确认是真实缺口，暂不处理）

排查方法见仓库记忆 `mui-api-e2e-service-coverage`：必须同时查 `src` 与 `e2e` 两个目录，避免漏数已有覆盖。以下均已按此方法核实为真实缺口。

### packages/app 路由层

- `routes/oauth.ts`：`POST /oauth/token`、`POST /oauth/revoke` 无测试（service 层 `oauth-token-service.ts` 有 e2e 覆盖，但绕过了 Hono HTTP 层，路由自身的 JSON 解析异常、grant_type 分支、错误状态码映射未验证）
- `routes/providers.ts`：`/providers/:provider/*` 原生透传代理路由层无测试（底层 credential 注入、usage 解析各自有单测，但路由自身的流式/非流式分支、计费胶水代码无测试）
- `routes/admin/spending.ts`：7 个端点里 6 个无测试——`POST /set-spending-limit`、`GET /global-config`、`POST /global-config`、`GET /usage`、`GET /spending-stats`、`GET /recharge-logs`（只有 `POST /unsuspend-user` 有覆盖）
- `routes/admin/users.ts`：`POST /set-concurrency`、`GET /user` 无测试
- `routes/admin/models.ts`：`PUT /:id`、`DELETE /:id` 无测试
- `routes/webhooks.ts`：`POST /webhooks/stripe` 路由层薄封装无测试（业务逻辑 `handleStripeWebhook` 本身在 `stripe-service.test.ts` 覆盖良好，风险较低）

### packages/dashboard

- 全部 15 个 `/api/admin/**` route.ts 无测试：`global-config`、`models/[id]`、`models`、`recharge-logs`、`recharge`、`set-concurrency`、`set-rate-multiplier`、`set-spending-limit`、`spending-stats`、`statistics`、`unsuspend-user`、`usage-summary`、`usage`、`user`、`users`
- `lib/wallet-do.ts`、`lib/top-up-service/{index,db,types,utils}.ts`（4 文件）无测试
- `lib/admin.ts`、`api.ts`、`auth.ts`、`auth-client.ts`、`email.ts`、`kv.ts`、`session.ts`、`stripe.ts`、`blog-content.ts`、`utils.ts` 无测试（风险与复杂度不一，`api.ts` 304 行、`kv.ts` 210 行相对值得优先关注）

### 脚本

- `scripts/submit-indexnow.ts` 的 CLI 编排函数（`parseArgs`/`fetchSitemapText`/`collectUrlList`/`submitToIndexNow`/`main`）无测试，且均未 `export`，要测需要先重构成可导出（纯函数部分 `scripts/indexnow.ts` 已有覆盖）

## 已知的次要缺口（2026-07-18 顺手发现，非阻塞）

- `playground-media-results.ts` 的 `toImageResult`/`downloadImage`/`downloadAudio`/`downloadVideo` 从未有测试（本轮拆分 `playground-utils.ts` 时原样保留，未新增覆盖）
- `UserDailyStatsSection` 无组件测试（依赖 `next/dynamic` 懒加载的 recharts 图表，本轮 admin/users/[userId] 测试基建范围只覆盖了 `UserProfileCard` + `UserRechargeSection`）
- `e2e/admin-users.test.ts` 只覆盖管理员 happy path，非管理员访问 `/admin/users/[userId]` 应被拒绝的场景未覆盖（需要第二个非管理员测试账号）
