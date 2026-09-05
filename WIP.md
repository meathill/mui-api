# WIP

## 博客迁移 muicv CMS：代码完成，待手动执行（2026-09-05）

- 代码全部合入 master：CMS 只读客户端、Markdown 渲染器、页面切 ISR、旧 MDX/D1 管线删除（`0030_drop_blog_tables`）、muicv 仓库配套改动在其 `feat/muirouter-blog` 分支（提交 f97d2c3）。详见 DEV_NOTE「博客内容源切换到 muicv CMS」。
- **待手动步骤（按序）**：
  1. 部署 muicv CMS：muicv 仓库 `feat/muirouter-blog` 分支跑 `pnpm deploy`（articles 集合新增 muirouter/de 枚举与 sources 等字段）。
  2. seed 数据：`MUICV_CMS_API_KEY=xxx MUIAPI_BLOG_EXPORT=packages/dashboard/blog-export.json node scripts/seed-blog-articles.ts --dry-run`（muicv 仓库，先核对 112 条再去掉 --dry-run）。
  3. 部署本仓库 dashboard 后线上验证博客列表/详情（重点看 gpt-6-astra 的 mermaid 图和调价文章的表格）。
  4. 跑 `pnpm --dir packages/dashboard run submit:indexnow` 提交搜索引擎。

## 进行中（feat-union 分支，2026-09-05 已 rebase 到新 master）

- **GA4 关键事件（issue #13）**：代码已完成（feat-union 提交 2e0bbc3）。合入部署后按 `docs/ga4-key-events.md` 做 DebugView 验证与后台关键事件标记。
- **AI 自主接入控制面**：未完成（feat-union 提交 c97d996 + 919f347，任务清单见该分支 WIP.md）。注意：wip 自带 2 个既有失败（meter-only.test.ts 仍走扣款）与 1 个类型错误（MUIROUTER_CONTROL 绑定未注册），恢复开发时先处理。
- 迁移文件已改名 `0029_integration_control.sql`（wrangler 按文件名跟踪已应用迁移，双 0028 虽能按字典序先后应用，但编号唯一是规范要求）。博客 drop 迁移已避开该编号，使用 `0030`。
