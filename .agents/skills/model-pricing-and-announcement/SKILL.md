---
name: model-pricing-and-announcement
description: 当上游 AI 厂商调价或发布新模型时，规范化执行模型调价、种子库同步、一次性 D1 脚本执行与中文博客发布流程
---

# 模型调价与博客发布标准工作流 (Model Pricing & Announcement Workflow)

本 Skill 用于当上游大模型提供商（如 OpenAI、Anthropic、Google、xAI、DeepSeek、Moonshot/Kimi、Xiaomi MiMo 等）发布新模型、调整模型费率或推出限时降价活动时，指导 AI 助手以最高质量与规范完成端到端的调价、数据同步与内容发布流程。

---

## 核心原则

1. **查证第一，数据精确**：必须从官方定价页、公告博客或官方社交媒体账号（X 等）获取最准确的官方原价与新价格（包括标准输入、标准输出、Prompt Caching 读取与写入倍率等）。
2. **价格变更不生成 Drizzle 迁移文件**：模型价格属于动态运营数据，**不要在 `packages/shared-db/drizzle/` 生成迁移文件**。统一使用**一次性 SQL 脚本 + 修改 Seed 数据**的模式。
3. **博客内容全部走 muicv CMS**：博客正文与元数据（含标题、摘要、tags、sources、readingMinutes）存 muicv Payload CMS 的 `articles` 集合（`site=muirouter`），本仓库**不再维护** `content/blog/*.mdx`、`blog-content.ts` 与 D1 博客表（2026-09 已迁移）。发布用 MCP 工具 `upsert_article`（或 muicv CMS 后台）。
4. **先中文审查，后多语翻译**：先撰写高质量中文版并发布（`locale=zh-CN`），待用户审查批准后，再逐语言补发其他 7 种（en, de, fr, es, pt, th, ja）。
5. **线上变更闭环**：执行一次性 SQL 写 D1（仅模型价格）-> 清理 Cloudflare KV `models:catalog` 缓存 -> 验证无误后立即删除临时脚本。

---

## 标准执行步骤

### 第一步：获取与核对官方价格

1. 确认目标模型的 upstream 规格：
   - 基础输入价（$/1M tokens）
   - 基础输出价（$/1M tokens）
   - 缓存命中价（Cached Input Price，通常为 10% 或 25%）
   - 缓存写入价（Cache Write Price，如 OpenAI GPT-5.6 家族为 1.25× input）
   - 是否有时效性限制（如限时 3 个月）或适用范围（API、订阅额度等）
2. 确认其在 MuiRouter 中的模型 ID 及短名 alias（如 `gpt-5.6-sol` 与 `gpt-5.6`）。

---

### 第二步：更新本地种子与基准数据

修改以下基准数据文件，确保本地开发与全新部署时状态一致：

1. **`packages/app/src/db/seed.ts`**：
   - 更新 `SEED_MODELS` 中对应模型的 `inputPrice`、`outputPrice` 及缓存计算辅助函数（如 `...openaiCacheWithWrite(newInputPrice)`）。
   - 顺带核对同家族其他模型的现行价格。
2. **`seed-models.sql`** & **`packages/dashboard/seed-models.sql`**：
   - 同步更新两份 SQL 种子文件中的对应行。

---

### 第三步：编写一次性生产执行脚本（仅模型价格）

在 `scripts/` 目录下生成临时 SQL 脚本（如 `scripts/update-<model-slug>-price.sql`）：

```sql
-- 一次性执行脚本：更新模型价格（博客已迁 muicv CMS，不再写 D1）
UPDATE models
SET
  input_price = <new_input_price>,
  output_price = <new_output_price>,
  cached_input_price = <new_cached_input_price>,
  cache_write_price = <new_cache_write_price>
WHERE id IN ('<model-id>', '<model-alias>');
```

---

### 第四步：撰写中文解读博客文章

直接撰写 Markdown 正文（不落盘到本仓库，最后通过 `upsert_article` 发布）。

**文章结构规范**：
1. **背景引言**：交代官方发布/降价的具体时间、背景和涉及模型；
2. **调价细节表格**：用 GFM 表格清晰呈现新旧价格对比、降幅百分比、同家族模型价格梯度对比；
3. **深度战略与技术解读**：
   - 从开发者与业务视角，深入分析（例如：输出端大幅降价对 Long Reasoning 与 Agent 循环成本的实质性影响）；
   - 分析大模型厂商之间的博弈（迎击开源模型、高端生态防守、算力承载测试与采购周期锁定等）；
4. **工程架构与多级路由推荐**：提供结合家族各档位模型（轻量预处理 + 中端实施 + 旗舰攻坚）与 Prompt Caching 的最佳 Cost-per-Task 实践；
5. **MuiRouter 跟进声明**：说明 MuiRouter 平台已实时生效新费率，引导前往 Playground 体验。

---

### 第五步：发布到 muicv CMS

用 MCP 工具 `upsert_article` 发布（幂等，slug 重复即更新；也可在 muicv Payload 后台手工编辑）：

- `site: "muirouter"`、`locale`：中文首发用 `"zh-CN"`（注意 CMS 用 `zh-CN` 不是 `zh`；其余语言为 `en/de/fr/es/pt/th/ja`）
- `title` / `summary`（80~150 字摘要）/ `bodyMarkdown`（正文 Markdown）/ `tags` / `keywords`
- `sources`：`[{ label, url }]` 官方定价页与公告链接；`sourcePublishedAt`：官方公告日期
- `readingMinutes`：按正文字数估算（CJK 350 字/分钟 + 拉丁 200 词/分钟）
- `publishedAt`：发布日期（ISO）；`status: "published"`；`author: "MuiRouter"`
- `seoTitle` / `seoDescription`：搜索引擎标题与 120~160 字描述

发布后站点侧 24h 内自然生效（`unstable_cache` 天级，无 webhook）；急发就手动跑：

```bash
pnpm --dir packages/dashboard run submit:indexnow -- --dry-run   # 预览
pnpm --dir packages/dashboard run submit:indexnow                # 实际提交
```

---

### 第六步：测试回归与收尾

1. **执行远程 D1 价格脚本**：
   ```bash
   pnpm --filter mui-api exec wrangler d1 execute mui-api --remote --file=../../scripts/update-<model-slug>-price.sql
   ```
2. **清理 Cloudflare KV 缓存**：
   ```bash
   pnpm --filter mui-api exec wrangler kv key delete --binding KV "models:catalog" --remote
   ```
3. **清理临时 SQL 文件**：
   ```bash
   rm scripts/update-<model-slug>-price.sql
   ```
4. **测试与质量回归**：
   ```bash
   pnpm run format
   pnpm run typecheck
   pnpm --filter mui-api test
   pnpm --filter mui-api-dashboard test
   pnpm --filter mui-api-dashboard build
   ```
5. **更新 WIP.md** 记录完成状态。
