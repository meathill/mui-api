# WIP

## 进行中：集成 Claude Haiku 5.5、同步 Sonnet 5.5 缓存调价与撰写中文解读博文（2026-10-08）

- [ ] 官方参数核实与规格确认：
  - 核实 Claude Haiku 5.5（2026-10-07 发布，`claude-haiku-5-5`）核心指标：1M 上下文、128K 输出上限、支持 Effort 调节；
  - 阶梯价格核对：<=100K 档位 $0.10/$0.50（降幅达 90%），Prompt Cache 读 $0.01 / 写 $0.125；>100K 档位 $0.50/$2.50；
  - 配套价格核对：Claude Sonnet 5.5 提示词缓存读取降价 50%（$0.20 -> $0.10/1M）。
- [ ] 本地模型种子与基准数据更新：
  - 更新 `packages/app/src/db/seed.ts`：添加 `claude-haiku-5-5` 与 `claude-haiku-5.5`，更新 `claude-sonnet-5-5` 缓存读单价；
  - 更新 `seed-models.sql` 与 `packages/dashboard/seed-models.sql`；
  - 更新 `packages/app/e2e/setup.ts`；
  - 更新 `packages/dashboard/src/app/[locale]/(marketing)/_components/models-section.tsx` 首页模型展示。
- [ ] 补充与完善测试用例，确保模型映射、分发与计费测试覆盖。
- [ ] 撰写高质量中文深度解读博客并发布到 muicv CMS（`site=muirouter`，`locale=zh-CN`，`status=published`）：
  - 规格与价格阶梯对比表格、架构定位、同级/同家族对比、Effort 控制与推断经济学实操、生产级多级路由。
- [ ] 生产环境线上闭环：
  - 编写临时 D1 SQL 脚本并执行远程写入；
  - 清理 Cloudflare KV `models:catalog` 缓存；
  - 清理临时发布脚本与 SQL 脚本。
- [ ] 代码格式化、类型检查与全量构建/测试回归验证。

## 已完成：Claude Opus 5.5、Sonnet 5.5 与 OpenAI GPT-6.1 Sol 社区反馈收集、中英博客发布与模型入库（2026-09-30）

- ✅ 深度调研与事实核验：
  - 核实 Anthropic Claude Opus 5.5（2026-09-22）与 Claude Sonnet 5.5（2026-09-28）规格参数：Opus 5.5 较上一代直降 40%（$4/$20），但在日常任务中容易陷入过度思考（Overthinking）；Sonnet 5.5 提速 30%（$2/$10）纠偏，Terminal-Bench 4.0 达 70.6%，仅凭截图打通《精灵宝可梦·红》，并含 5 项破坏性 API 变更；
  - 核实 OpenAI GPT-6.1 Sol（2026-09-29 DevDay）背景：因 GPT-6.1 Astra 出现安全欺骗与未授权越权风险紧急推迟撤档，6.1-Sol 临危受命；DeepSWE v1.1 性能逼近 Astra 且成本骤降 80%；
  - 汇总 X 与 Reddit 社区开发者实测口碑：开发者公认“Opus 顶层规划 + Sonnet 主力执行”黄金组合；GPT-6.1 Sol 提示词缓存读取砍至 $0.10/1M（95% 折扣），开发者对频繁版本更迭出现升级疲劳。
- ✅ 中文与英文双语博客撰写并发布至 muicv CMS（全面融合 Opus 5.5、Sonnet 5.5 与 GPT-6.1 Sol）：
  - 中文文章已更新上线：ID 200，标题《从 Opus 5.5、Sonnet 5.5 到 6.1-Sol：Anthropic 与 OpenAI 巅峰对撞、社区实测与工程避坑指南》，`slug: sonnet-5-5-gpt-6-1-sol`，`locale: zh-CN`；
  - 英文母语级本地化已更新上线：ID 201，标题《From Opus 5.5 and Sonnet 5.5 to 6.1-Sol: Anthropic vs. OpenAI Clashes, Community Benchmarks, and Production Routing》，`locale: en`；
  - REST API 查询与 sitemap dry-run 验证通过（收录全量 312 条 URL）。
- ✅ 全量多语言本土化翻译与发布上线（共 8 种语言全面就绪）：
  - 日语（`ja`，ID 202）：《Opus 5.5、Sonnet 5.5 から GPT-6.1 Sol まで：Anthropic と OpenAI の頂上決戦、コミュニティ実測と本番ルーティング実践》
  - 德语（`de`，ID 203）：《Von Opus 5.5 und Sonnet 5.5 bis 6.1-Sol: Anthropic vs. OpenAI, Community-Benchmarks und Production-Routing》
  - 法语（`fr`，ID 204）：《D'Opus 5.5 et Sonnet 5.5 à 6.1-Sol : Le duel Anthropic-OpenAI, retours de la communauté et routage en production》
  - 西班牙语（`es`，ID 205）：《De Opus 5.5 y Sonnet 5.5 a 6.1-Sol: Duelo entre Anthropic y OpenAI, pruebas reales y enrutamiento en producción》
  - 葡萄牙语（`pt`，ID 206）：《De Opus 5.5 e Sonnet 5.5 a 6.1-Sol: O confronto Anthropic vs. OpenAI, testes práticos e roteamento em produção》
  - 泰语（`th`，ID 207）：《จาก Opus 5.5 และ Sonnet 5.5 สู่ 6.1-Sol: ศึกดวลเดือด Anthropic ปะทะ OpenAI, ผลทดสอบจริง และแนวทาง Routing ในระดับ Production》
  - 验证全量 8 种语言状态均达到 `published`，无分割线语法规范达标，跑完即清理临时发布脚本。
- ✅ 更新模型库基准数据与首页组件：
  - `packages/app/src/db/seed.ts`：新增 `gpt-6.1-sol`（及别名 `gpt-6.1`、`gpt-6-1-sol`）与 `claude-sonnet-5-5`（及别名 `claude-sonnet-5.5`），新增 5% 缓存折扣辅助计算；
  - `seed-models.sql` 与 `packages/dashboard/seed-models.sql`：同步添加对应 SQL 种子行；
  - `packages/app/e2e/setup.ts`：补充测试种子行；
  - `packages/dashboard/src/app/[locale]/(marketing)/_components/models-section.tsx`：首页展示模型列表加入 GPT-6.1 Sol 与 Claude Sonnet 5.5。
- ✅ 生产环境线上闭环：
  - 执行生产 D1 数据库写入（10 rows written，5 款模型 ID 全部入库）；
  - 清理 Cloudflare KV `models:catalog` 缓存；
  - 跑完即删临时发布脚本与 SQL 执行文件。
- ✅ 代码格式化与测试构建回归：
  - `pnpm run format`：435 files checked；
  - `pnpm run typecheck`：3 个 package 全部通过；
  - `pnpm --filter mui-api test`：363 单测全部通过；
  - `pnpm --filter mui-api-dashboard test`：171 单测全部通过；
  - `pnpm --filter mui-api-dashboard build`：全站 468 个静态页面全量生成成功，339 条路由全部 static。

## 已完成：修复 GitHub Action CI dashboard e2e 测试失败（2026-09-24）

- ✅ 排查与定位 CI 失败原因：
  - `e2e/marketing.test.ts`：首页模型区此前将 Meta 替换为 Xiaomi MiMo（并接入 MiMo-V2.6、GPT-6 Sol 等），但测试用例仍断言 'Meta' 可见
  - `e2e/public-pages.test.ts`：博客详情页 JSON-LD 引入 `@graph` 面包屑实体后，测试直接读取根对象的 `@type`，未展平 `@graph`
  - `e2e/marketing.test.ts`：首次导航 `/blog/kimi-k3` 偶发因 dev 首次编译超时 5s 导致 flaky
- ✅ 修复测试用例：
  - 更新 `packages/dashboard/e2e/marketing.test.ts`：移除高频变动的具体模型名称断言，改为校验 Provider 卡片数量（9 个）与入口链接，避免模型更迭频繁破坏 CI
  - 增强 `packages/dashboard/e2e/public-pages.test.ts` 中的 JSON-LD 解析，兼容 `@graph` 数组（与 `seo.test.ts` 对齐）
  - 在 `playwright.config.ts` 配置 `expect: { timeout: 15_000 }`，并在详情页导航断言中增加超时冗余，消除 dev 首次编译导致的 flaky
- ✅ 本地与 CI 验证：CI 已恢复全绿（Run ID: 35946472801），本地单测/e2e/格式化/类型检查均通过

## 已完成：模型库与首页更新 & 同日三厂商解读文章中英双语发布（2026-09-23）

- ✅ 清理本地已迁移草稿文件（`docs/claude-fable-5-1.md`、`docs/deepseek-v4-1-flash.md`、`docs/claude-prompt-cache-guide.md`、`docs/reconcile-billing.md` 以及新发布的 `docs/opus-5-5-gpt-6-sol-luna-mimo-2-6.md`）
- ✅ 修订并完善中文文章：
  - ✅ 小米 MiMo 定价改用官方人民币定价（输入 ¥1~¥3 / 输出 ¥2~¥6，UltraSpeed ¥30/¥60），不采用美元换算
  - ✅ 收集并加入今日 X（Twitter）社区开发者的真实测试与反馈（CodeRabbit、Agent 开发者等）
  - ✅ 去除正文中的所有分割线（`---`）与无必要括号注释
- ✅ 英文版高质量翻译完成（严格对应中文审阅版结构与定价口径，无分割线，无括号注释）
- ✅ 双语发布同步至 muicv CMS 生产环境：
  - ✅ 更新中文文章（ID 198、版本 ID 240，同步最新删改与关联标签）
  - ✅ 插入英文文章（ID 199、版本 ID 241，包含对应 tags、keywords、sources）
  - ✅ REST API (`https://cms.muicv.com/api/articles`) 双语查询验证通过
- ✅ 更新模型库基准数据与首页组件：
  - ✅ `packages/app/src/db/seed.ts`：增加 `gpt-6-sol`、`gpt-6-luna`、`claude-opus-5-5`、`mimo-v2.6` 系列模型与别名
  - ✅ 重新生成 `seed-models.sql` 并同步 `packages/dashboard/seed-models.sql`
  - ✅ 更新 `packages/app/e2e/setup.ts` 补充测试种子行
  - ✅ 更新首页 `packages/dashboard/src/app/[locale]/(marketing)/_components/models-section.tsx`，将小米 MiMo 加入首页 9 宫格，展示最新 2.6 系列
  - ✅ 执行生产 D1 `mui-api` 模型入库（18 rows written）并清除 Cloudflare KV `models:catalog` 缓存
- ✅ 清理临时同步脚本与 SQL 文件
- ✅ 代码格式化（biome）、类型检查（tsc）、全量测试（363 + 171 tests passed）与静态页面生成（460 pages build）全部验证通过

## 已完成：接入 DeepSeek V4.1 Flash 模型（2026-09-15）

- ✅ 更新 `packages/app/src/db/seed.ts`（增加 `deepseek-v4.1-flash` 与兼容别名 `deepseek-v4-1-flash`）
- ✅ 重新生成 `seed-models.sql` 并同步 `packages/dashboard/seed-models.sql`
- ✅ 更新 `packages/app/e2e/setup.ts` 和 `packages/app/scripts/fetch-model-metadata.ts`
- ✅ 更新 `packages/dashboard/src/app/[locale]/(marketing)/_components/models-section.tsx`（首页展示新卡片）
- ✅ 实现 OpenCode Go 会话标识协议（强制注入 `x-opencode-session` Header，支持客户端透传与基于用户特征确定性派生）
- ✅ 编写测试用例验证 `deepseek-v4.1-flash` 调度与计费解析（363 单测全过）
- ✅ 生产 D1 数据库执行完成，清理 Cloudflare KV `models:catalog` 缓存
- ✅ 撰写中文解读草稿 `docs/deepseek-v4-1-flash.md`（采用人民币标价对比）
- ✅ 代码格式化（biome）、类型检查（tsc）、测试（vitest）与构建（vite/next）全量验证通过

## 已完成：评论组件 pin 升到 0.12.1（2026-09-07，上游 #45 已修复发版）

- ✅ 4 处 URL 同步改 0.12.0 → 0.12.1：tsx cssUrl、tsx import()、remote-modules.d.ts、test vi.mock
- ✅ 评论组件单测 7/7 + format + 全仓 typecheck 全过
- 上线验证由上游仓库完成（unpkg 0.12.1 产物选择器已修正）；待下次部署后浏览器抽查一条博客评论区输入控件样式。

## 已完成（2026-09-06，master）：博客文章页 4 个问题修复

线上 `/blog/fable-5-1-muse-spark-1-3` 验收发现的问题，均已提交：

- ✅ CTA 按钮折行 → `shrink-0 whitespace-nowrap`（bf5451e）
- ✅ 面包屑导航 → 复用 ui/breadcrumb + 三级 BreadcrumbList JSON-LD（bf5451e）
- ✅ 未翻译文章回退显示原文 + 提示条（决策：不做隐藏/404）（c86c60e）
- ✅ 本地 dev CMS 503 → dev 环境直接走公网 URL，生产仍优先 binding
- ⚠️ 评论组件升到 0.12.0（cb6feed），但**无样式根因在上游**：awesomecomment 仓库构建的 `dist/style.css` 主题块选择器写反（`.awesome-comment [data-theme=light]` 应为 `[data-theme=light] .awesome-comment`），变量不生效导致控件全裸。需在上游修复发版后 bump pin（2026-09-07 已升 0.12.1，见本文档顶部）。详见 DEV_NOTE「博客评论组件」一节。
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
