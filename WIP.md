# WIP

## 进行中：SEO 修复（issue #14 LCP + issue #15 描述/语言回落），2026-10-15

**背景结论**
- #14 只剩 `/mcp-router` LCP：它与 `/ai-router` 是同一组件、同一布局，差异来自 TTFB（`incrementalCache: 'dummy'` → 预渲染 HTML 每次在 Worker 重渲染，实测 1.2–3.6s、`x-nextjs-cache: MISS`）。
- #15 根因：`buildMetadata` 无条件 self-canonical + 8 语言 hreflang；sitemap 无条件 8 语言全收录；标题叠了 `- MuiRouter` 与模板 `| MuiRouter`。博客的 `documentLocale` 已存在但 metadata 层未用。
- 结论：不删 `/mcp-router` 或 `/ai-router`（文案与搜索意图独立，仅共享版式外壳）。

**任务分解**

- [ ] A. canonical / hreflang / sitemap 按「有译文的语言」收敛
  - [ ] A1 `lib/seo.ts`：`getLanguageAlternates(href, available)`、`getPrimaryLocale()`、`buildMetadata({ translations })`（canonical/OG url/locale 跟随）
  - [ ] A2 `lib/blog.ts`：`LocalizedBlogPost.availableLocales`、`BlogSitemapPost.locales`
  - [ ] A3 博客列表/详情页：传 `translations`；JSON-LD url 用 documentLocale 路径
  - [ ] A4 `legal-content.ts` 导出 `getLegalDocLocales()`；about/privacy/terms/contact/models 传 `translations=['en','zh']`
  - [ ] A5 `app/sitemap.ts`：每页带 locale 集合，alternates 同步过滤
  - [ ] A6 更新 `seo.test.ts` / `blog.test.ts` / `sitemap.test.ts`
- [ ] B. 文案：描述 ≥120 字符、标题显示宽度 ≤65（含 ` | MuiRouter`）
  - [ ] B1 枚举脚本列出不达标清单（跑完删除）
  - [ ] B2 about/contact/privacy/terms/models 的 en+zh 文案抽到共享模块
  - [ ] B3 8 语言逐条改写；首页 title 缩短；去掉品牌重复后缀
  - [ ] B4 新增 `messages-meta.test.ts` 回归断言
- [ ] C. #14：复查 PSI（×3 取中位）→ 恢复 R2 增量缓存（`open-next.config.ts` + `wrangler.jsonc` `NEXT_INC_CACHE_R2_BUCKET=site-cache`）→ 部署后复核 → 更新 DEV_NOTE.md 缓存决策段
- [ ] 收尾：format / typecheck / test / build；分主题提交；#14 #15 写修复汇总（#15 附 CMS 待改清单，不关闭）

**交给用户的事项**
- CMS 侧：7 篇文章的 zh/ja `summary` 扩写到 120–160 字符（muicv articles 集合，代码侧读不到），清单见 issue #15 评论。

## 待办 / 后续规划

- **Gemini 4 Argon 与 3.8 Flash 多语言博文翻译**：中文版已于 2026-10-14 首发上线（ID 209，`gemini-4-argon-3-8-flash-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
- **Claude Haiku 5.5 多语言博文翻译**：中文版已于 2026-10-08 首发上线（ID 208，`claude-haiku-5-5-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。

## 进行中（feat-union 分支，2026-09-05 已 rebase 到新 master）

- **GA4 关键事件（issue #13）**：代码已完成（feat-union 提交 2e0bbc3）。合入部署后按 `docs/ga4-key-events.md` 做 DebugView 验证与后台关键事件标记。
- **AI 自主接入控制面**：未完成（feat-union 提交 c97d996 + 919f347，任务清单见该分支 WIP.md）。注意：wip 自带 2 个既有失败（meter-only.test.ts 仍走扣款）与 1 个类型错误（MUIROUTER_CONTROL 绑定未注册），恢复开发时先处理。
- 迁移文件已改名 `0029_integration_control.sql`（wrangler 按文件名跟踪已应用迁移，双 0028 虽能按字典序先后应用，但编号唯一是规范要求）。博客 drop 迁移已避开该编号，使用 `0030`。
