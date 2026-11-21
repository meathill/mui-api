# WIP

## 进行中：Google 登录后进控制台 14 秒（issue #22，2026-11-21 修复完成，待部署验证）

Clarity 回放（会话 167ty30）实测新用户 Google OAuth 后 /zh/app 首屏 14s。排查结论：callback 是 better-auth 库内逻辑（2 次 Google 外网往返 + D1 三表写入，不可插桩）；可优化的是外层——多跳 307 重定向、SSR 阻塞 D1 session 查询、hydration 后 3 个 API 各自重复查 D1（无 cookieCache）、零观测、加载期只有一行文本。目标：登录 → 控制台可交互 ≤ 3s。

- [x] 观测先行：dashboard 开 observability（wrangler.jsonc），新建 `src/lib/request-timing.ts`，打点 auth handler / (dashboard) layout getSession / `GET /api/user`、`GET /api/user/keys`
- [x] better-auth `session.cookieCache`（maxAge 60s）：首屏 4 次 D1 session 查询 → 1 次；条款/admin 滞后窗口收窄到 60s
- [x] 登录落地 URL 带 locale（social-login-buttons）：zh 用户直达 `/zh/app`，省 307 一跳；login/register 的 next-intl router 本就 locale-aware 无需改
- [x] 条款检查去请求化：TermsConsentDialog 删挂载 GET、改 layout SSR 传 `needsReconsent` prop（复用 `legal.needsReconsent`）；POST 改走 `auth.api.updateUser`（同步 session 并刷新 cookieCache，避免同意后重弹）；首屏请求 3 → 2
- [x] /app 首屏「加载中...」文本换骨架屏（ui/skeleton.tsx 组合，与卡片 grid 同构，aria-busy）
- [x] TermsConsentDialog 组件测试 6 项 + 全量回归：vitest 280、e2e 49、typecheck 3 包、format、build 405 路由全 static
- [x] DEV_NOTE.md 记 cookieCache trade off 与「user 表写入必须走 updateUser」规范；TODO.md 记 `listUserApiKeys` KV 全量 list 扩展性隐患
- [x] 压平提交（81378ee 代码 + 9570077 文档）推送 master，Workers Builds 构建成功；线上 curl 冒烟通过，wrangler tail 确认 `[dashboard-timing]` 打点已输出
- [x] 用户实测联动验证（tail 51 条请求）：cookieCache 生效（已登录 layout getSession 0ms）；**头号嫌疑坐实一半——每个新 isolate 首请求 ≈1s**（静态页 959ms、首个 API 1048ms，热启动后 15–93ms），14s 是登录回跳链路多跳冷启动的叠加；callback 请求被 tail 抽样丢掉两次，耗时待 Workers Logs 后台查
- [x] 用户实测反馈追加修复（392cad8）：登出按钮加 disabled + Spinner（sign-out wall 590ms 无反馈）；22 文件 56 处 Link 加 `prefetch={false}`（实测进站打出 8 个并发 `_rsc` prefetch 各撞 ~500ms 冷启动），登录/注册互跳与 header 登录 CTA 保留
- [ ] 等待验证（不再主动实测）：Clarity 未来登录回放看首屏数据 + observability 后台 `[dashboard-timing]` 历史分布；达标 ≤3s 后关闭 issue #22；冷启动如坐实再评估 Worker 预热等解法

## 已完成：充值流失排查 + 漏斗埋点 + 余额区交互升级（issue #23，2026-11-21 已关闭）

背景：香港高意向用户两次充值未完成（Clarity 会话 167ty30），取消原因只有 `?topUp=cancelled` 一个可见信号；余额「$0.00」卡片被点击两次无响应（dead click）。

- [x] `src/lib/analytics.ts` 埋点封装（`trackEvent`/`setCustomTag`：Clarity + GA4 gtag stub），Clarity 延迟加载导致 hydration 事件丢失的坑用待发队列 + `DeferredClarity` 的 `onReady` flush 解决；6 项单测
- [x] `app/page.tsx` 接入漏斗事件：`topup_checkout_started`（+`setCustomTag('topup_amount')`）/ `topup_returned_success` / `topup_completed` / `topup_cancelled`（两条取消路径）/ `topup_checkout_failed` / `topup_balance_card_clicked` / `topup_add_credit_clicked`
- [x] 余额卡整体可点（stretched button，滚动到充值卡 + 1.5s 高亮，select-none + hover/focus 反馈）；金额旁「充值」按钮弹金额选择框（新组件 `components/top-up-dialog.tsx`，4 项组件测试）；8 语言 i18n 补 `addCredit`/`dialogTitle`/`balanceCardAria`
- [x] `scripts/check-stripe-topup.ts` 只读核对脚本（时间窗 checkout sessions + 账户 payment method 配置 + PaymentIntent 最后错误）；用受限 key（需 checkout_session_read / payment_intent_read / pmc 读权限）跑出结论
- [x] **Stripe 结论**：找到该用户两条 $10 Session（08:57:46 / 08:59:30 UTC），均 expired/unpaid、无 PaymentIntent、无 last_payment_error；会话内已展示 card + alipay + link + wechat_pay——「缺支付方式」「卡被拒」均排除，根因指向结账页摩擦（与 #22 加载慢叠加），转 #22 承接
- [x] 回归全绿：format、typecheck（3 包）、vitest 274、build 405 路由全 static；压平提交 b936fdb 并 push，构建 success
- [x] 埋点封装用法与 flush 决策已并入 DEV_NOTE.md「关键模式」；#23 已评论结论并关闭
- 后续观察：Clarity `topup_*` 漏斗积累数据后复核流失位置；若结账页放弃仍高再考虑档位/币种呈现优化

## 已完成：Clarity 巡检 UX 问题修复（issues #17–#20，2026-11-19 全部关闭）

代码修复 → 全套回归通过（vitest 264、e2e 49、typecheck、format、build 405 路由全 static）→ push 自动触发 Workers Builds 部署 → 生产 curl 验证四个修复特征全部生效 → issues #17–#20 已评论（含 Clarity 证据与验证结论）并关闭。

- **#17** models-section 整卡改 `<Link>` 深链 `/models?provider={id}`，models 页 searchParams 预选厂商筛选（fb7f4d0）。
- **#18** 核查确认「统一按 USD/1M tokens 展示」无隐藏展开交互；pricing 标题区/SummaryPanel/补充说明 + ai-router 特性卡片加 `select-none`（f95d66e）。
- **#19** `md` 以下汉堡 + Sheet 抽屉（链接保持纯 `<a>` 语义，SheetClose 会强加 role=button 故弃用），登录 CTA 常驻；`header.menu` 补 8 语言（a4c5bab）。
- **#20** 核查确认 logo/导航本就是真实 `<a>`；死区主因是 HeaderAuthCta 的 loading 占位块，改 SSR 游客优先渲染登录锚点（9f12a95）。
- 遗留观察项：issue #21（抖音渠道秒退）为观察项未处理；下次 Clarity 巡检复核移动端 320–480px 体验与 dead click 比例变化。

## 已完成：OpenAI GPT-6.2 Sol / Astra 接入、退役模型清理与解读博客发布（2026-11-18）

- [x] 核对官方发布信息与 API 规格：
  - `gpt-6.2-astra`（含别名 `gpt-6-2-astra`）：输入 $8.00/M、输出 $40.00/M（较 GPT-6 Astra 降价 20%）、缓存命中 $0.40/M（5%，降价 60%）、缓存写入 $10.00/M（1.25×），1.05M 上下文 / 922K 最大输入 / 128K 最大输出，知识截止 2026-05-18。
  - `gpt-6.2-sol`（含别名 `gpt-6.2`、`gpt-6-2-sol`）：输入 $2.00/M、输出 $10.00/M、缓存命中 $0.10/M（5%）、缓存写入 $2.50/M（1.25×），1.05M 上下文 / 922K 最大输入 / 128K 最大输出，知识截止 2026-06-01；均延续 272K 长上下文 2×/1.5× 计费规则。
- [x] 退役模型盘点与清理（共清理 35 条 D1 冗余/退役记录，种子库收敛至 82 行）：
  - 清理 6 条 D1 孤儿脏数据（`gpt-5.4`、`gpt-5.5`、`gemini-3.1-flash-lite-preview`、`gemini-3.5-flash`、`grok-4`、`grok-build-0.1`）。
  - 清理 29 条上游已废弃、即将停服或被完全替代且近 30 天零调用的模型：OpenAI（`gpt-5`、`gpt-5-mini`、`gpt-5-nano`、`gpt-4.1`、`gpt-4o-mini`）、Google（`gemini-2.5-pro`、`gemini-2.5-flash`、`gemini-2.5-flash-lite`、`gemini-3.6-flash`、`gemini-3-6-flash`）、Anthropic（`claude-fable-5`、`claude-opus-4-6`/`4-7`/`4-8`、`claude-sonnet-4-6`、`claude-haiku-4-5`）、Workers AI（`qwen3-30b`、`kimi-k2.6`）、DeepSeek（`deepseek-v4-flash`、`deepseek-v4-flash-vision-exp`）、Xiaomi MiMo（`mimo-v2.5-pro`、`mimo-v2-pro`、`mimo-v2.5`、`mimo-v2-omni`、`mimo-v2.5-flash`）、MiniMax（`minimax-m2.5`、`minimax-m2.7`）、GLM/Qwen 旧版（`glm-5.1`、`qwen3.6-plus`）。
  - 注：`gpt-4o` 定于 2027-01-14 停服，但近 30 天仍有 192 次生产调用及多个示例引用，本次暂保留。
- [x] 同步基准种子数据与首页精选：更新 `packages/app/src/db/seed.ts`、`seed-models.sql`、`packages/dashboard/seed-models.sql`、`packages/app/e2e/setup.ts`、`packages/app/scripts/fetch-model-metadata.ts` 与 `packages/dashboard/src/app/[locale]/(marketing)/_components/models-section.tsx`。
- [x] 补充单元测试：在 `packages/app/src/services/model-catalog-service.test.ts` 与 `packages/app/src/services/provider-dispatch.test.ts` 中增加 `gpt-6.2-astra` / `gpt-6.2-sol` / `gpt-6.2` 解析及 `/v1/responses` 透传单测。
- [x] 生产 D1 同步与缓存刷新：写入 GPT-6.2 系列、删除 35 条退役/孤儿记录、回填 82 条元数据并删除临时 SQL 脚本，清除 Cloudflare KV `models:catalog` 缓存。
- [x] 撰写并发布中文解读博客到 muicv CMS（ID 219，`site=muirouter`，`locale=zh-CN`，`slug=gpt-6-2-astra-sol-released`，`status=published`），通过 `check:cms-seo`（0 违规），升级 `BLOG_CACHE_VERSION` 至 `v8`，提交 IndexNow（283 条 URL，状态码 200）。
- [x] 运行全套质量门禁：format（448 files）、typecheck（3 packages）、单测（373 + 261 全绿）、生产构建（405 条预渲染路由全部 static）。

## 已完成：Google Gemini 4 Carbon 与 Hydrogen 接入并发布解读博客（2026-11-13）

- [x] 核对官方发布信息与 API 规格：
  - Gemini 4 Carbon（`gemini-4-carbon`）：输入 $2.00/M、输出 $10.00/M、缓存命中 $0.10/M（95% 优惠），1M 上下文，最强深度推演与安全防御。
  - Gemini 4 Hydrogen（`gemini-4-hydrogen`）：输入 $1.50/M、输出 $7.50/M、缓存命中 $0.075/M（95% 优惠），1M 上下文，Flash 系列官方替代者，超快推理与高性价比 Agent 工作流。
- [x] 同步基准种子数据：在 `packages/app/src/db/seed.ts`、`seed-models.sql`、`packages/dashboard/seed-models.sql`、`packages/app/e2e/setup.ts` 中补充 `gemini-4-carbon` 与 `gemini-4-hydrogen`。
- [x] 维护元数据规范：在 `packages/app/scripts/fetch-model-metadata.ts` 中补充 `gemini-4-carbon` 与 `gemini-4-hydrogen` 的能力元数据。
- [x] 首页 9 宫格模型精选同步：在 `packages/dashboard/src/app/[locale]/(marketing)/_components/models-section.tsx` 中为 Anthropic 补充 `Claude Fable 5.2`，为 Google 补充 `Gemini 4 Carbon` 与 `Gemini 4 Hydrogen`。
- [x] 修复 Playwright E2E（`public-pages.test.ts`）因博文标题匹配导致的 strict mode violation。
- [x] 补充单元测试：在 `packages/app/src/services/model-catalog-service.test.ts` 中增加 `gemini-4-carbon` 与 `gemini-4-hydrogen` 目录查询与解析单测。
- [x] 生产 D1 数据库写入与元数据补充：写入 `gemini-4-carbon` 与 `gemini-4-hydrogen`，清理 Cloudflare KV `models:catalog` 缓存。
- [x] 撰写中文深度技术解读博客，融入 Fable 5.2 深度思维过拟合启示并压缩 20% 篇幅，严格遵循 issue #15 SEO 约束（seoTitle 显示宽度 34 ≤ 65、seoDescription 125 字符在 120-160 字符区间）。
- [x] 调用 muicv CMS 接口发布中文博文（ID 218，`site=muirouter`，`locale=zh-CN`，`slug=gemini-4-carbon-released`，`status=published`），运行 `check:cms-seo` 验证 0 违规。
- [x] 升级 `packages/dashboard/wrangler.jsonc` 中 `vars.BLOG_CACHE_VERSION` 至 `v7`，执行 IndexNow 提交 282 条 URL（状态码 200）。
- [x] 运行全套质量门禁（typecheck、format、全量单测 371+261 项全绿）。




## 已完成：Anthropic Claude Fable 5.2 接入与发布解读博客（2026-11-10）

- [x] 核对官方发布信息（Anthropic 官方公告、API 定价与规格）：Mythos 级底座、超难数学与科学突破、长程 Agent 协同（1000+ 子 Agent 连续 8 天）、输出速度提升 30%、可选 Fast Mode（2.5x 速度）、API 降价 20%（输入 $8/M、输出 $40/M、缓存命中 $0.20/M 即 2.5%、缓存写入 $10.00/M 即 1.25×，1M 上下文，128k 最大输出）。
- [x] 同步 MuiRouter 模型目录与基准数据：在 `packages/app/src/db/seed.ts`、`seed-models.sql`、`packages/dashboard/seed-models.sql`、`packages/app/scripts/fetch-model-metadata.ts`、`packages/app/e2e/setup.ts` 中补充 `claude-fable-5-2` 与短别名 `claude-fable-5.2`。
- [x] 编写测试用例验证新模型在分发调度与归一化逻辑中的正确解析与单测通过（`provider-dispatch.test.ts` 28/28、`chat-completions-anthropic.test.ts` 2/2 通过）。
- [x] 撰写中文深度技术解读博客，严格遵循 issue #15 SEO 约束（seoTitle 显示宽度 50 ≤ 65、seoDescription 151 字符在 120-160 字符区间）。
- [x] 调用 muicv CMS 接口发布中文博文（ID 217，`site=muirouter`，`locale=zh-CN`，`slug=claude-fable-5-2-released`，`status=published`），并运行 `check:cms-seo` 验证 0 违规。
- [x] 执行生产 D1 种子数据同步（`seed-models.sql` 写入 104 行），清理 Cloudflare KV `models:catalog` 缓存；升级 `BLOG_CACHE_VERSION` 至 `v6`，并执行 IndexNow 提交 281 条 URL。
- [x] 执行全套回归测试（格式化、类型检查、单测 371+261 全部通过、生产构建通过且 381 条路由全为 static）。

## 已完成：注册页模板主标题语义 H1 修复（Issue #16，2026-11-10）

- [x] 针对注册页主标题语义编写测试用例（`packages/dashboard/src/app/[locale]/(marketing)/register/page.test.tsx` 组件单测，覆盖语义与翻译；更新 `packages/dashboard/e2e/auth.test.ts` 与 `packages/dashboard/e2e/seo.test.ts`）。
- [x] 修改 `packages/dashboard/src/app/[locale]/(marketing)/register/page.tsx`，将 `<h2 className="text-xl font-bold text-center mb-5">{t('title')}</h2>` 调整为 `h1`，保留原有类名、样式与文案翻译。
- [x] 运行测试套件验证全部测试通过（vitest 组件测试 32 个文件 261 项测试全过、Playwright 23 项 E2E 测试全过）。
- [x] 运行类型检查、代码格式化与生产构建验证（`pnpm run typecheck`、`pnpm run format`、`pnpm --dir packages/dashboard run build` 518 个页面全部预渲染为 static，实测生成的 `es/register.html`、`zh/register.html` 等包含唯一语义 h1）。
- [x] 清理并归档文档，执行阶段性 git 提交。

## 已完成：博客详情页与全局样式修复（Mermaid、JSON 渲染、Dark Mode 按钮、表格宽屏展示，2026-10-27）

- [x] 修复 Dark Mode 按钮字体颜色：在 `packages/dashboard/src/app/globals.css` 中将 `.dark` 下 `--primary-foreground` 和 `--sidebar-primary-foreground` 修正为深墨色 `#231b14`，消除明亮黄色按钮上的白字低对比度问题。
- [x] 修复 Markdown 代码块与 JSON 渲染问题：在 `packages/dashboard/src/components/marketing/markdown-renderer.tsx` 中拆分 inline code 与 block code，移除 block code 中被误加的 inline pill 样式，使用品牌暗色代码块风格，并为 JSON 代码块增加结构化语法高亮。
- [x] 优化文章表格排版与宽屏扩展：允许表格和宽幅元素在阅读流中扩展至 1.5x–1.67x 正文宽度（`max-w-6xl lg:max-w-7xl`），表头设置 `whitespace-nowrap`，彻底消除大屏幕下被窄栏挤压产生的横向滚动条。
- [x] 修复 Mermaid 渲染逻辑并更新 CMS 博文：`MarkdownRenderer` 强化 Mermaid 提取与图表容错；直连远程 D1 `muicv` 数据库将 `gpt-6-1-terra-released` 博文（ID 215 及 `_articles_v`）3.1 节的 ASCII 字符画转换为标准 `flowchart TD` Mermaid 语法。
- [x] 编写并补充单元测试，验证 Markdown 代码块、JSON 高亮、Mermaid 与宽表格渲染，全量回归测试（typecheck、format、test 全部 100% 通过）。


## 已完成：OpenAI GPT-6.1 Terra 发布解读博客与模型接入（2026-10-27）

- [x] 核对官方发布信息（X 官方推文、技术博客、API 定价与规格）：视觉推断与 Computer Use 突破、Agents' Last Exam 比肩 GPT-6 Astra 且 token 成本仅 1/10、速度快 3 倍、API 价格较 GPT-5.6 Terra 和 GPT-6.1 Sol 腰斩（输入 $1/M、输出 $5/M、缓存命中 $0.05/M、缓存写入 $1.25/M，1.1M 上下文）。
- [x] 同步 MuiRouter 模型目录与基准数据：在 `packages/app/src/db/seed.ts`、`seed-models.sql`、`packages/dashboard/seed-models.sql`、`packages/app/scripts/fetch-model-metadata.ts` 中补充 `gpt-6.1-terra` 与短别名 `gpt-6-1-terra`。
- [x] 编写测试用例验证新模型在分发调度与目录服务中的正确解析与单测通过（`provider-dispatch.test.ts` 26/26 通过）。
- [x] 撰写中文深度技术解读博客，严格遵循 issue #15 SEO 约束（seoTitle 显示宽度 35 ≤ 65、seoDescription 153 字符在 120-160 字符区间）。
- [x] 调用 muicv CMS 接口发布中文博文（ID 215，`site=muirouter`，`locale=zh-CN`，`slug=gpt-6-1-terra-released`，`status=published`），并运行 `check:cms-seo` 验证 0 违规。
- [x] 编写一次性生产 SQL 脚本并在生产 D1 执行写入 4 行数据，清理 Cloudflare KV `models:catalog` 缓存，清理临时脚本。
- [x] 执行全套回归测试（格式化、类型检查、单测 369+256 全部通过、生产构建验证）。

## 已完成：Kimi K3.1 Pro 发布解读博客与模型支持（2026-10-24）

- [x] 核对官方发布信息（X 官方推文、技术博客、API 定价与上下文规格）：2.8T MoE 3T 级开源权重（11/04 开源）、1M 上下文、代码/3D 建模 CAD/金融分析全面突破、幻觉降低 65%、API 降价 33.3%（输入 $2/M、输出 $10/M、缓存命中 $0.2/M）。
- [x] 撰写中文深度技术解读博客，严格遵循 issue #15 SEO 约束（seoTitle 显示宽度 34 ≤ 65、seoDescription 152 字符在 120-160 字符区间）。
- [x] 同步 MuiRouter 模型目录与基准数据：在 `seed.ts`、`seed-models.sql`、`packages/dashboard/seed-models.sql`、`fetch-model-metadata.ts` 中补充 `kimi-k3.1-pro` 与 `kimi-k3.1-pro-highspeed`（及别名）。
- [x] 编写测试用例验证新模型在 Moonshot 分发调度中的正确解析（`provider-dispatch.test.ts` 24/24 通过）。
- [x] 调用 muicv CMS 接口发布中文博文（ID 211，`site=muirouter`，`locale=zh-CN`，`slug=kimi-k3-1-pro-released`，`status=published`），并运行 `check:cms-seo` 验证 0 违规。
- [x] 编写一次性生产 SQL 脚本并在生产 D1 执行写入 4 行数据，成功清理 Cloudflare KV `models:catalog` 缓存，清理临时脚本。
- [x] 执行全套回归测试（格式化、类型检查、单测 367+256 全部通过、生产构建通过且 365 条路由全为 static）。

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

- **GPT-6.2 Astra 与 Sol 多语言博文翻译**：中文版已于 2026-11-18 首发上线（ID 219，`gpt-6-2-astra-sol-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
- **Gemini 4 Carbon 多语言博文翻译**：中文版已于 2026-11-12 首发上线（ID 218，`gemini-4-carbon-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
- **Claude Fable 5.2 多语言博文翻译**：中文版已于 2026-11-10 首发上线（ID 217，`claude-fable-5-2-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
- **Kimi K3.1 Pro 多语言博文翻译**：中文版已于 2026-10-24 首发上线（ID 211，`kimi-k3-1-pro-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
- **DeepSeek-V4.1-Flash-1017 多语言博文翻译**：中文版已于 2026-10-17 首发上线（ID 210，`deepseek-v4-1-flash-1017-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
- **Gemini 4 Argon 与 3.8 Flash 多语言博文翻译**：中文版已于 2026-10-14 首发上线（ID 209，`gemini-4-argon-3-8-flash-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
- **Claude Haiku 5.5 多语言博文翻译**：中文版已于 2026-10-08 首发上线（ID 208，`claude-haiku-5-5-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
  - 注：以上篇目目前只有中文文档，其余语言页因 canonical 收敛到中文版而不再被重复收录（issue #15）；补齐译文后 canonical 会自动恢复自指（`getDocumentLocales` 由 CMS 文档推导，无需改代码）。

## 进行中（feat-union 分支，2026-09-05 已 rebase 到新 master）

- **GA4 关键事件（issue #13）**：代码已完成（feat-union 提交 2e0bbc3）。合入部署后按 `docs/ga4-key-events.md` 做 DebugView 验证与后台关键事件标记。
- **AI 自主接入控制面**：未完成（feat-union 提交 c97d996 + 919f347，任务清单见该分支 WIP.md）。注意：wip 自带 2 个既有失败（meter-only.test.ts 仍走扣款）与 1 个类型错误（MUIROUTER_CONTROL 绑定未注册），恢复开发时先处理。
- 迁移文件已改名 `0029_integration_control.sql`（wrangler 按文件名跟踪已应用迁移，双 0028 虽能按字典序先后应用，但编号唯一是规范要求）。博客 drop 迁移已避开该编号，使用 `0030`。
