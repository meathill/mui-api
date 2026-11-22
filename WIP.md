# WIP

进行中任务与近期规划。已完成任务的明细见 git log 与对应 GitHub issue 评论，不在此处保留归档。

## 待办 / 后续规划

- **GPT-6.2 Astra 与 Sol 多语言博文翻译**：中文版已于 2026-11-18 首发上线（ID 219，`gpt-6-2-astra-sol-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
- **Gemini 4 Carbon 多语言博文翻译**：中文版已于 2026-11-12 首发上线（ID 218，`gemini-4-carbon-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
- **Claude Fable 5.2 多语言博文翻译**：中文版已于 2026-11-10 首发上线（ID 217，`claude-fable-5-2-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
- **Kimi K3.1 Pro 多语言博文翻译**：中文版已于 2026-10-24 首发上线（ID 211，`kimi-k3-1-pro-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
- **DeepSeek-V4.1-Flash-1017 多语言博文翻译**：中文版已于 2026-10-17 首发上线（ID 210，`deepseek-v4-1-flash-1017-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
- **Gemini 4 Argon 与 3.8 Flash 多语言博文翻译**：中文版已于 2026-10-14 首发上线（ID 209，`gemini-4-argon-3-8-flash-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
- **Claude Haiku 5.5 多语言博文翻译**：中文版已于 2026-10-08 首发上线（ID 208，`claude-haiku-5-5-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
  - 注：以上篇目目前只有中文文档，其余语言页因 canonical 收敛到中文版而不再被重复收录（issue #15）；补齐译文后 canonical 会自动恢复自指（`getDocumentLocales` 由 CMS 文档推导，无需改代码）。

## 进行中（feat-union 分支，2026-09-05 已 rebase 到新 master）

- **GA4 关键事件（issue #13）**：代码已完成（feat-union 提交 2e0bbc3）。合入部署后按 `docs/ga4-key-events.md`（存在于 feat-union 分支）做 DebugView 验证与后台关键事件标记。
- **AI 自主接入控制面**：未完成（feat-union 提交 c97d996 + 919f347，任务清单见该分支 WIP.md）。注意：wip 自带 2 个既有失败（meter-only.test.ts 仍走扣款）与 1 个类型错误（MUIROUTER_CONTROL 绑定未注册），恢复开发时先处理。
- 迁移文件已改名 `0029_integration_control.sql`（wrangler 按文件名跟踪已应用迁移，双 0028 虽能按字典序先后应用，但编号唯一是规范要求）。博客 drop 迁移已避开该编号，使用 `0030`。
