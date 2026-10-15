# WIP

## 已完成：SEO 修复（issue #14 LCP + issue #15 描述/语言回落），2026-10-15 — 两个 issue 均已关闭

- 代码与配置已上线（`1287c93`、`be18b0e`、`13928c5`、`e7f6123`、`37541ff`），线上复核通过，汇总见 issue #14 / #15 评论。
- CMS 侧也一并做完（用户授权直接改）：muicv D1 `articles` 表——114 条 `seoTitle` 压到含品牌后缀 ≤65 显示宽度、23 条 `seoDescription` 补到 120–160、4 条超 320 的压短；博客页改为优先读这两个字段（缺失回退 `title` / `summary`）。改完用重新部署让 ISR 缓存立即刷新。
- 新增 `pnpm --dir packages/dashboard run check:cms-seo`：发布或批量改文案后校验三条约束（当前 0 处违规），约束同时写进 `.agents/skills/model-pricing-and-announcement/SKILL.md` 第五步。
- 长期结论已并入 `DEV_NOTE.md`：缓存决策段（R2 增量缓存为何接回、如何回退）、「无译文页面的 canonical 与 meta 文案约束」小节，以及 CMS 两套文案的字段分工与直改 D1 的做法。
- PSI 官方分数按用户决定跳过复查（缓存 HIT / 本地 Lighthouse / TTFB 地板线三项替代证据已记在 issue #14）。

## 待办 / 后续规划

- **Gemini 4 Argon 与 3.8 Flash 多语言博文翻译**：中文版已于 2026-10-14 首发上线（ID 209，`gemini-4-argon-3-8-flash-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
- **Claude Haiku 5.5 多语言博文翻译**：中文版已于 2026-10-08 首发上线（ID 208，`claude-haiku-5-5-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
  - 注：这两篇目前只有中文文档，其余语言页因 canonical 收敛到中文版而不再被重复收录（issue #15）；补齐译文后 canonical 会自动恢复自指（`getDocumentLocales` 由 CMS 文档推导，无需改代码）。

## 进行中（feat-union 分支，2026-09-05 已 rebase 到新 master）

- **GA4 关键事件（issue #13）**：代码已完成（feat-union 提交 2e0bbc3）。合入部署后按 `docs/ga4-key-events.md` 做 DebugView 验证与后台关键事件标记。
- **AI 自主接入控制面**：未完成（feat-union 提交 c97d996 + 919f347，任务清单见该分支 WIP.md）。注意：wip 自带 2 个既有失败（meter-only.test.ts 仍走扣款）与 1 个类型错误（MUIROUTER_CONTROL 绑定未注册），恢复开发时先处理。
- 迁移文件已改名 `0029_integration_control.sql`（wrangler 按文件名跟踪已应用迁移，双 0028 虽能按字典序先后应用，但编号唯一是规范要求）。博客 drop 迁移已避开该编号，使用 `0030`。
