# WIP

## 进行中：Google Gemini 新模型接入（Gemini 4 Argon & 3.8 Flash 等）与深度博客发布（2026-10-14）

- [x] **步骤一：核对与精算价格数据**：
  - 接入 `gemini-4-argon`（旗舰推理，$2.00 / $10.00，缓存 $0.10 即 5%，1M 上下文）
  - 接入 `gemini-3.8-flash`（高智力 Flash，$0.75 / $3.75，缓存 $0.075 即 10%）
  - 接入 `gemini-3.6-flash`、`gemini-3.5-flash-lite`、`gemini-3.1-flash-lite`、`gemini-3.1-pro-preview` 及其别名
  - 修正现存 `gemini-2.5-pro`、`gemini-2.5-flash`、`gemini-2.5-flash-lite`、`gemini-3-flash` 缓存定价（25% 修正为官方基准 10%）
- [x] **步骤二：更新本地模型库与测试数据**：
  - `packages/app/src/db/seed.ts`：更新 `geminiCache`（10% 基准），新增 Argon / 3.8 Flash 等模型定义与别名
  - `seed-models.sql` 与 `packages/dashboard/seed-models.sql`：同步更新两份 SQL 种子
  - `packages/app/e2e/setup.ts`：追加测试种子行
  - `packages/app/src/services/model-catalog-service.test.ts`：补充别名与查询解析测试用例（并增强 `ModelCatalogService` 中间段版本号 dot/hyphen 容错）
  - `packages/dashboard/src/app/[locale]/(marketing)/_components/models-section.tsx`：将 Google (Gemini 4 Argon / 3.8 Flash 等) 纳入首页 9 宫格
- [x] **步骤三：生产环境变更**：
  - 编写一次性 SQL 脚本 `scripts/update-gemini-models.sql`
  - 远程执行生产 D1 数据库写入（30 rows written，15 条模型记录全部更新/入库）
  - 清理 Cloudflare KV `models:catalog` 缓存并校验
  - 移除临时 SQL 文件
- [x] **步骤四：撰写中文解读博文并发布至 muicv CMS**：
  - 中文深度博文发布上线：ID 209，标题《Gemini 4 Argon 与 3.8 Flash 震撼登场：推理旗舰重定标杆、Flash 家族代际升级与推断经济学全解析》，`slug: gemini-4-argon-3-8-flash-released`，`locale: zh-CN`，`status: published`
  - 包含价格阶梯对比表格、Argon 推理深度解读、Flash 家族代际演进、Prompt Caching 5%~10% 折扣经济学及四级路由拓扑结构
  - IndexNow 提交成功（状态码 200，共提交 328 条 URL）
  - 验证 REST API 返回正常，临时发布脚本已清理
- [x] **步骤五：代码格式化、类型检查与全量构建回归**：
  - `pnpm run format`：442 files checked
  - `pnpm run typecheck`：3 个 packages 全部通过
  - `pnpm --filter mui-api test`：365 单测全量通过
  - `pnpm --filter mui-api-dashboard test`：200 单测全量通过
  - `pnpm --filter mui-api-dashboard build`：全站 486 个静态页面成功生成，349 条路由全部 static 验证通过

## 进行中（feat-union 分支，2026-09-05 已 rebase 到新 master）

- **GA4 关键事件（issue #13）**：代码已完成（feat-union 提交 2e0bbc3）。合入部署后按 `docs/ga4-key-events.md` 做 DebugView 验证与后台关键事件标记。
- **AI 自主接入控制面**：未完成（feat-union 提交 c97d996 + 919f347，任务清单见该分支 WIP.md）。注意：wip 自带 2 个既有失败（meter-only.test.ts 仍走扣款）与 1 个类型错误（MUIROUTER_CONTROL 绑定未注册），恢复开发时先处理。
- 迁移文件已改名 `0029_integration_control.sql`（wrangler 按文件名跟踪已应用迁移，双 0028 虽能按字典序先后应用，但编号唯一是规范要求）。博客 drop 迁移已避开该编号，使用 `0030`。

## 待办 / 后续规划

- **Gemini 4 Argon 与 3.8 Flash 多语言博文翻译**：中文版已于 2026-10-14 首发上线（ID 209，`gemini-4-argon-3-8-flash-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。
- **Claude Haiku 5.5 多语言博文翻译**：中文版已于 2026-10-08 首发上线（ID 208，`claude-haiku-5-5-released`）。待用户审阅批准后，按规范跟进其余 7 种语言（en/ja/de/fr/es/pt/th）的母语级翻译发布。

