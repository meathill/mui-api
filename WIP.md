# WIP

## 进行中（feat-union 分支，2026-09-05 已 rebase 到新 master）

- **GA4 关键事件（issue #13）**：代码已完成（feat-union 提交 2e0bbc3）。合入部署后按 `docs/ga4-key-events.md` 做 DebugView 验证与后台关键事件标记。
- **AI 自主接入控制面**：未完成（feat-union 提交 c97d996 + 919f347，任务清单见该分支 WIP.md）。注意：wip 自带 2 个既有失败（meter-only.test.ts 仍走扣款）与 1 个类型错误（MUIROUTER_CONTROL 绑定未注册），恢复开发时先处理。
- 迁移文件已改名 `0029_integration_control.sql`（wrangler 按文件名跟踪已应用迁移，双 0028 虽能按字典序先后应用，但编号唯一是规范要求）。博客 drop 迁移已避开该编号，使用 `0030`。

## 已完成（2026-09-06，知识已并入 DEV_NOTE，无需跟进）

- 博客迁移 muicv CMS 上线：CMS 部署 + 迁移 + seed 113 条 + 新文章 fable-5-1-muse-spark-1-3（zh 先行，待用户审查后补 7 语言翻译）。
- 接入 muse-spark-1.3（seed + 生产 D1 + KV 清缓存）；首页 ModelsSection 展示 GPT-6 Astra / Claude Fable 5.1 / Muse Spark 1.3。
- 修复 service binding fetch 相对路径 bug（og/sitemap 恢复）；IndexNow 已提交 296 条 URL。
- **遗留**：dyqr 仓库的 cms-blog-client.ts 存在同款 binding 相对路径 bug（被 D1 降级掩盖），建议择机修复。
