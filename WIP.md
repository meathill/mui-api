# WIP

## Issue #13: GA4 关键事件（SEO 转化衡量）

- 代码已完成：`lib/analytics.ts` + 单测、Consent Mode v2 默认 denied + CookieConsentBanner（8 语种）、sign_up / api_key_created / playground_first_run / begin_checkout / purchase 埋点、AnalyticsIdentity（user_id）、隐私政策 Cookies 条款
- [ ] 合入 master 部署后按 `docs/ga4-key-events.md` 做 GA4 DebugView 验证与后台关键事件标记，完成后关 issue

## AI 自主接入、配置与升级

- [ ] 中心项目、默认模型、provider connection、配置版本与权限
- [ ] meter_only：完整计量、跳过余额/抵扣/扣款/视频资金预占
- [ ] MCP SDK 升级、管理工具、资源及共享控制 API
- [ ] CLI PKCE 登录、connect/doctor/upgrade/run 与凭证安装
- [ ] 单源接入 skill、网站发布、用户级安装
- [ ] 中心回归、迁移、部署、凭证配置及实际接入验收
- [ ] 第一批迁移：app-feedback、blog-2026、awesome-comment、saas、glams、taomenu
- [ ] 第二批迁移：dyqr、mui-gamebook、mui-memo、muicv、sf-aigc-hackathon-2023、x-downloader

明确排除 carrot-word、dnd、ireagle-cms、mui-ad、free-ai-api、woshare 与不活跃项目。既有 .zcode/ 和 scripts/test-compat-cache.ts 属于用户工作，不纳入本任务提交。内部项目仅跳过 MuiRouter 钱包扣款，各产品终端用户套餐/积分规则保留。

迁移文件已改名 `0029_integration_control.sql`（master 的 0028 已被 terms consent 占用，2026-09-05 rebase 时处理）。
