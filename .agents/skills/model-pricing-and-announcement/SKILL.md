---
name: model-pricing-and-announcement
description: 当上游 AI 厂商调价或发布新模型时，规范化执行模型调价、种子库同步、一次性 D1 脚本执行与中文博客发布流程
---

# 模型调价与博客发布标准工作流 (Model Pricing & Announcement Workflow)

本 Skill 用于当上游大模型提供商（如 OpenAI、Anthropic、Google、xAI、DeepSeek、Moonshot/Kimi、Xiaomi MiMo 等）发布新模型、调整模型费率或推出限时降价活动时，指导 AI 助手以最高质量与规范完成端到端的调价、数据同步与内容发布流程。

---

## 核心原则

1. **查证第一，数据精确**：必须从官方定价页、公告博客或官方社交媒体账号（X 等）获取最准确的官方原价与新价格（包括标准输入、标准输出、Prompt Caching 读取与写入倍率等）。
2. **不生成 Drizzle 迁移文件**：模型价格与博客文章元数据属于动态运营数据，**不要在 `packages/shared-db/drizzle/` 生成迁移文件**。统一使用**一次性 SQL 脚本 + 修改 Seed 数据**的模式。
3. **先中文审查，后多语翻译**：先撰写高质量、有深度的中文版本（`*.zh.mdx`），在 `blog-content.ts` 中先将各语言 loader 统一指向中文。待用户审查批准后，再翻译并补齐其他 7 种语言（en, fr, es, pt, de, th, ja）。
4. **线上变更闭环**：执行一次性 SQL 脚本写入 D1 数据库 -> 清理 Cloudflare KV `models:catalog` 缓存 -> 验证无误后立即清理删除该临时 SQL 脚本。

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

### 第三步：编写一次性生产执行脚本

在 `scripts/` 目录下生成临时 SQL 脚本（如 `scripts/update-<model-slug>-price-and-post.sql`）：

```sql
-- 一次性执行脚本：更新模型价格并插入博客文章元数据
UPDATE models
SET
  input_price = <new_input_price>,
  output_price = <new_output_price>,
  cached_input_price = <new_cached_input_price>,
  cache_write_price = <new_cache_write_price>
WHERE id IN ('<model-id>', '<model-alias>');

INSERT OR REPLACE INTO blog_posts (slug, published_at, source_published_at, reading_minutes, status)
VALUES
  ('<blog-slug>', '<YYYY-MM-DD>', '<YYYY-MM-DD>', 5, 'published');

INSERT OR REPLACE INTO blog_post_translations (
  slug,
  locale,
  title,
  description,
  tags_json,
  sources_json
)
VALUES
  (
    '<blog-slug>',
    'zh',
    '<中文文章标题>',
    '<中文文章简介描述>',
    '["<Tag1>", "<Tag2>"]',
    '[{"label":"<官方定价源>","url":"<URL>"},{"label":"<官方公告>","url":"<URL>"}]'
  ),
  (
    '<blog-slug>',
    'en',
    '<English Title>',
    '<English Description>',
    '["<Tag1>", "<Tag2>"]',
    '[{"label":"<Official Pricing>","url":"<URL>"}]'
  );
```

---

### 第四步：撰写中文解读博客文章

在 `packages/dashboard/src/content/blog/<blog-slug>.zh.mdx` 编写文章。

**文章结构规范**：
1. **背景引言**：交代官方发布/降价的具体时间、背景和涉及模型；
2. **调价细节表格**：清晰呈现新旧价格对比、降幅百分比、同家族模型价格梯度对比；
3. **深度战略与技术解读**：
   - 从开发者与业务视角，深入分析（例如：输出端大幅降价对 Long Reasoning 与 Agent 循环成本的实质性影响）；
   - 分析大模型厂商之间的博弈（迎击开源模型、高端生态防守、算力承载测试与采购周期锁定等）；
4. **工程架构与多级路由推荐**：提供结合家族各档位模型（轻量预处理 + 中端实施 + 旗舰攻坚）与 Prompt Caching 的最佳 Cost-per-Task 实践；
5. **MuiRouter 跟进声明**：说明 MuiRouter 平台已实时生效新费率，引导前往 Playground 体验。

---

### 第五步：注册 Dashboard Loader 与验证测试

1. **`packages/dashboard/src/lib/blog-content.ts`**：
   - 声明 `<modelSlug>Loaders`，各语言（en, zh, fr, es, pt, de, th, ja）初始均指向 `.zh.mdx`；
   - 在 `blogContentLoaders` 对象中注册 `<blog-slug>`。
2. **测试与质量回归**：
   - 在 `packages/dashboard/src/lib/blog.test.ts` 补充 `hasBlogContent('<blog-slug>')` 单测；
   - 运行单元测试：
     ```bash
     pnpm --filter mui-api test
     pnpm --filter mui-api-dashboard test
     ```
   - 运行代码格式化与类型检查：
     ```bash
     pnpm run format
     pnpm run typecheck
     ```
   - 验证 Next.js 生产构建：
     ```bash
     pnpm --filter mui-api-dashboard build
     ```

---

### 第六步：执行线上变更与清理

1. **执行远程 D1 数据库脚本**：
   ```bash
   pnpm --filter mui-api exec wrangler d1 execute mui-api --remote --file=../../scripts/update-<model-slug>-price-and-post.sql
   ```
2. **清理 Cloudflare KV 缓存**：
   ```bash
   pnpm --filter mui-api exec wrangler kv key delete --binding KV "models:catalog" --remote
   ```
3. **清理临时 SQL 文件**：
   ```bash
   rm scripts/update-<model-slug>-price-and-post.sql
   ```
4. **更新 WIP.md** 记录完成状态。
