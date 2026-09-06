# WIP

## 已完成（2026-09-06，master）：博客文章页 4 个问题修复

线上 `/blog/fable-5-1-muse-spark-1-3` 验收发现的问题，均已提交：

- ✅ CTA 按钮折行 → `shrink-0 whitespace-nowrap`（bf5451e）
- ✅ 面包屑导航 → 复用 ui/breadcrumb + 三级 BreadcrumbList JSON-LD（bf5451e）
- ✅ 未翻译文章回退显示原文 + 提示条（决策：不做隐藏/404）（c86c60e）
- ✅ 本地 dev CMS 503 → dev 环境直接走公网 URL，生产仍优先 binding
- ⚠️ 评论组件升到 0.12.0（cb6feed），但**无样式根因在上游**：awesomecomment 仓库构建的 `dist/style.css` 主题块选择器写反（`.awesome-comment [data-theme=light]` 应为 `[data-theme=light] .awesome-comment`），变量不生效导致控件全裸。需在上游修复发版后 bump pin。详见 DEV_NOTE「博客评论组件」一节。
- 回归：171 单测 / format / typecheck / build 全过；浏览器验收 en+zh 两 locale（面包屑、提示条、按钮单行、JSON-LD @graph 均正确）。

## 进行中（feat-union 分支，2026-09-05 已 rebase 到新 master）

- **GA4 关键事件（issue #13）**：代码已完成（feat-union 提交 2e0bbc3）。合入部署后按 `docs/ga4-key-events.md` 做 DebugView 验证与后台关键事件标记。
- **AI 自主接入控制面**：未完成（feat-union 提交 c97d996 + 919f347，任务清单见该分支 WIP.md）。注意：wip 自带 2 个既有失败（meter-only.test.ts 仍走扣款）与 1 个类型错误（MUIROUTER_CONTROL 绑定未注册），恢复开发时先处理。
- 迁移文件已改名 `0029_integration_control.sql`（wrangler 按文件名跟踪已应用迁移，双 0028 虽能按字典序先后应用，但编号唯一是规范要求）。博客 drop 迁移已避开该编号，使用 `0030`。

## 已完成（2026-09-06，知识已并入 DEV_NOTE，无需跟进）

- 博客迁移 muicv CMS 上线：CMS 部署 + 迁移 + seed 113 条 + 新文章 fable-5-1-muse-spark-1-3（zh 先行，待用户审查后补 7 语言翻译）。
- 接入 muse-spark-1.3（seed + 生产 D1 + KV 清缓存）；首页 ModelsSection 展示 GPT-6 Astra / Claude Fable 5.1 / Muse Spark 1.3。
- 修复 service binding fetch 相对路径 bug（og/sitemap 恢复）；IndexNow 已提交 296 条 URL。
- **遗留**：dyqr 仓库的 cms-blog-client.ts 存在同款 binding 相对路径 bug（被 D1 降级掩盖），建议择机修复。
