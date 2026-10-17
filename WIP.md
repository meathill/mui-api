# WIP

## 已完成：DeepSeek-V4.1-Flash-1017 升级解读博客与模型支持（2026-10-17）

- [x] 核对官方发布信息（X 官方推文、HF 权重页面、基准测试分数与特性）：小版本大飞跃、帕累托改进（性能增强 + 输出更短更省）、系统指令遵循、自反馈 RL 驱动的 0 到 1 许愿式编程、官方生态框架协同。
- [x] 撰写中文深度技术解读博客草稿，满足 CMS 字段规范与 issue #15 SEO 约束（seoTitle 显示宽度 45 ≤ 65、seoDescription 155 字符在 120-160 范围内）。
- [x] 同步 MuiRouter 模型目录与基准数据：在 `seed.ts`、`seed-models.sql`、`packages/dashboard/seed-models.sql` 中补充 `deepseek-v4.1-flash-1017`（及短别名），并更新 `fetch-model-metadata.ts`。
- [x] 编写测试用例验证新模型在目录服务与分发调度中的正确解析（`provider-dispatch.test.ts` 23/23 通过）。
- [x] 调用 muicv CMS 接口发布中文博文（ID 210，`site=muirouter`，`locale=zh-CN`，`slug=deepseek-v4-1-flash-1017-released`，`status=published`），并运行 `check:cms-seo` 验证 0 违规。
- [x] 编写一次性生产 SQL 脚本并在生产 D1 执行写入 4 行数据，成功清理 Cloudflare KV `models:catalog` 缓存，清理临时脚本。
- [x] 执行全套回归测试（格式化、类型检查、单测 366+256 全部通过、生产构建通过且 357 条路由全为 static）。

## 已完成：SEO 修复（issue #14 LCP + issue #15 描述/语言回落），2026-10-15 — 两个 issue 均已关闭

- 代码与配置已上线（`1287c93`、`be18b0e`、`13928c5`、`e7f6123`、`37541ff`），线上复核通过，汇总见 issue #14 / #15 评论。
- CMS 侧也一并做完（用户授权直接改）：muicv D1 `articles` 表——114 条 `seoTitle` 压到含品牌后缀 ≤65 显示宽度、23 条 `seoDescription` 补到 120–160、4 条超 320 的压短；博客页改为优先读这两个字段（缺失回退 `title` / `summary`）。改完用重新部署让 ISR 缓存立即刷新。
- 新增 `pnpm --dir packages/dashboard run check:cms-seo`：发布或批量改文案后校验三条约束（当前 0 处违规），约束同时写进 `.agents/skills/model-pricing-and-announcement/SKILL.md` 第五步。
- 长期结论已并入 `DEV_NOTE.md`：缓存决策段（R2 增量缓存为何接回、如何回退）、「无译文页面的 canonical 与 meta 文案约束」小节，以及 CMS 两套文案的字段分工与直改 D1 的做法。
- PSI 官方分数按用户决定跳过复查（缓存 HIT / 本地 Lighthouse / TTFB 地板线三项替代证据已记在 issue #14）。

## 待办 / 后续规划

- **DeepSeek-V4.1-Flash-1017 多语言博文翻译**：中文版已于 2026-10-17 首发上线（ID 210，`deepseek-v4-1-flash-1017-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
- **Gemini 4 Argon 与 3.8 Flash 多语言博文翻译**：中文版已于 2026-10-14 首发上线（ID 209，`gemini-4-argon-3-8-flash-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
- **Claude Haiku 5.5 多语言博文翻译**：中文版已于 2026-10-08 首发上线（ID 208，`claude-haiku-5-5-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
  - 注：以上篇目目前只有中文文档，其余语言页因 canonical 收敛到中文版而不再被重复收录（issue #15）；补齐译文后 canonical 会自动恢复自指（`getDocumentLocales` 由 CMS 文档推导，无需改代码）。

## 进行中（feat-union 分支，2026-09-05 已 rebase 到新 master）

- **GA4 关键事件（issue #13）**：代码已完成（feat-union 提交 2e0bbc3）。合入部署后按 `docs/ga4-key-events.md` 做 DebugView 验证与后台关键事件标记。
- **AI 自主接入控制面**：未完成（feat-union 提交 c97d996 + 919f347，任务清单见该分支 WIP.md）。注意：wip 自带 2 个既有失败（meter-only.test.ts 仍走扣款）与 1 个类型错误（MUIROUTER_CONTROL 绑定未注册），恢复开发时先处理。
- 迁移文件已改名 `0029_integration_control.sql`（wrangler 按文件名跟踪已应用迁移，双 0028 虽能按字典序先后应用，但编号唯一是规范要求）。博客 drop 迁移已避开该编号，使用 `0030`。
