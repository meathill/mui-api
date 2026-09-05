# TODO

长期待办，按发现时间倒序排列；开工前先读，避免与已评估过的事项重复盘点。

## 计费与模型目录（2026-09-05 接入 GPT-6 Astra 时发现）

- ~~`service_tier` fast/priority 未参与计费~~：已于同日修复——计费按上游回显的 `service_tier` 应用倍率（fast/priority 2×、flex 0.5×），usage_logs.tier 扩展 fast/flex 变体。
- **`gpt-6` 路由别名（备选）**：官方仅发布 `gpt-6-astra`（无短别名），平台暂不加；如用户反馈需要，可加一条 `upstreamModelId` 指向 astra 的别名条目，未来 OpenAI 发新变体时再调整映射。

## 测试覆盖缺口（2026-07-18 维护轮次盘点，已确认是真实缺口，暂不处理）

排查方法见仓库记忆 `mui-api-e2e-service-coverage`：必须同时查 `src` 与 `e2e` 两个目录，避免漏数已有覆盖。以下均已按此方法核实为真实缺口。

> 2026-09-05 维护轮次已覆盖：`routes/oauth.ts` 路由层（token/revoke 全分支单测）、dashboard `lib/kv.ts`（内存 KV 假实现全函数覆盖），已从下列清单移除。

### packages/app 路由层

- `routes/providers.ts`：`/providers/:provider/*` 原生透传代理路由层无测试（底层 credential 注入、usage 解析各自有单测，但路由自身的流式/非流式分支、计费胶水代码无测试）
- `routes/admin/spending.ts`：7 个端点里 6 个无测试——`POST /set-spending-limit`、`GET /global-config`、`POST /global-config`、`GET /usage`、`GET /spending-stats`、`GET /recharge-logs`（只有 `POST /unsuspend-user` 有覆盖）
- `routes/admin/users.ts`：`POST /set-concurrency`、`GET /user` 无测试
- `routes/admin/models.ts`：`PUT /:id`、`DELETE /:id` 无测试
- `routes/webhooks.ts`：`POST /webhooks/stripe` 路由层薄封装无测试（业务逻辑 `handleStripeWebhook` 本身在 `stripe-service.test.ts` 覆盖良好，风险较低）

### packages/dashboard

- 全部 15 个 `/api/admin/**` route.ts 无测试：`global-config`、`models/[id]`、`models`、`recharge-logs`、`recharge`、`set-concurrency`、`set-rate-multiplier`、`set-spending-limit`、`spending-stats`、`statistics`、`unsuspend-user`、`usage-summary`、`usage`、`user`、`users`
- `lib/wallet-do.ts`、`lib/top-up-service/{index,db,types,utils}.ts`（4 文件）无测试
- `lib/admin.ts`、`api.ts`、`auth.ts`、`auth-client.ts`、`email.ts`、`session.ts`、`stripe.ts`、`utils.ts` 无测试（`api.ts` 304 行相对值得优先关注；`blog-content.ts` 已随博客迁移 muicv CMS 删除，其替代 `lib/cms-blog-client.ts` 有单测）

### 脚本

- `scripts/submit-indexnow.ts` 的 CLI 编排函数（`parseArgs`/`fetchSitemapText`/`collectUrlList`/`submitToIndexNow`/`main`）无测试，且均未 `export`，要测需要先重构成可导出（纯函数部分 `scripts/indexnow.ts` 已有覆盖）

## 已知的次要缺口（2026-07-18 顺手发现，非阻塞）

- `playground-media-results.ts` 的 `toImageResult`/`downloadImage`/`downloadAudio`/`downloadVideo` 从未有测试（本轮拆分 `playground-utils.ts` 时原样保留，未新增覆盖）
- `UserDailyStatsSection` 无组件测试（依赖 `next/dynamic` 懒加载的 recharts 图表，本轮 admin/users/[userId] 测试基建范围只覆盖了 `UserProfileCard` + `UserRechargeSection`）
- `e2e/admin-users.test.ts` 只覆盖管理员 happy path，非管理员访问 `/admin/users/[userId]` 应被拒绝的场景未覆盖（需要第二个非管理员测试账号）
