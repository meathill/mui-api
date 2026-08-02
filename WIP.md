# WIP

## 客户端模型自动发现（2026-07-25）

目标：别人在 opencode 等客户端里配置 MuiRouter 时，只填 endpoint + key 就能刷出模型。

- [x] migration 0023：`models` 表加 `display_name` / `context_length` / `max_output_tokens` / `metadata_json`
- [x] `scripts/fetch-model-metadata.ts` 从 models.dev 回填元数据 → migration 0024（生产 48 个模型命中 47）
- [x] `GET /v1/models` 返回 context_length / pricing / capabilities（`owned_by` 改为 `muirouter`）
- [x] admin 模型表单加对外元数据编辑区
- [x] `scripts/gen-models-dev-toml.ts` 生成 models.dev 提交材料（30 个 chat 模型）
- [x] `/opencode` 接入文档页 + 8 语种
- [x] **部署**：生产跑 0023 + 0024（48 行中 47 行有完整元数据）、清 KV `models:catalog`、push 触发部署
- [x] 用生产数据重新生成 TOML：38 个 chat 模型，python `tomllib` 全量 schema 校验通过
- [x] **提 PR**：[anomalyco/models.dev#3749](https://github.com/anomalyco/models.dev/pull/3749)（38 个 chat 模型，CI 全绿、mergeable）
  - 审阅机器人三轮意见，已修：logo.svg（新画极简爪印 mark，源文件 `scripts/models-dev-assets/logo.svg`）、`gpt-5.6` 改走 `base_model`
  - 已核实为误判、未改：`gemini-3-flash` 继承名 / `gpt-5.4` 缺 cache_read / `grok-4.5` cache 占比——均确认与我们 D1 真实数据一致
  - [x] `gemini-3-flash-preview` 重复价格问题：你直接在生产删掉了这个模型，只留 `gemini-3-flash`，问题解决
  - [x] 你新增 `gemini-3.5-flash` / `gemini-3.5-flash-lite` / `gemini-3.6-flash` 三个模型（2026-07-27）
    - migration 0025 回填元数据（49/50 命中，缺口仍是 `mimo-v2.5-flash`）
    - migration 0026 修正 `gemini-3.5-flash-lite` 的 provider 录入错误（误填 `openai`，两个兄弟模型都是 `google-ai-studio`；错的这行会把请求打到 OpenAI API 上导致用户调不通）——已授权直接改
    - 顺手修了 `fetch-model-metadata.ts` 的一个 bug：迁移文件名之前硬编码成 `0024`，重跑会原地覆盖已经在生产跑过的那份（wrangler 按文件名去重，覆盖后的改动不会被应用，静默丢失）。改成扫目录自动取下一个序号
    - 两条迁移 + 清 KV 均已上生产
  - [x] PR 分支同步更新：删掉 `gemini-3-flash-preview.toml`，加 3 个新模型，`gemini-3-flash`/`gemini-3.1-pro-preview` 顺带刷新了价格（读的是最新生产数据）；重新过了一遍 merge 模拟 + 新增的「同价格跨产品线」扫描，无异常
  - [x] `gpt-5.4` 缺 `cache_read`：你在后台补上了 `cached_input_price=0.25`，重新生成 PR 材料（只改了这一个文件，×1.05=0.2625 与机器人预测值一致），清 KV，已推送并回复 PR
  - **待实测**：Claude 模型的 `reasoning_options` 是否准确——取决于 CF AI Gateway 把 OpenAI 风格 `reasoning_effort` 转成 Anthropic `thinking.budget_tokens` 的内部逻辑，代码库里查不到，需要真实调一次 API 验证
  - 现在按你的决定：先不继续跟机器人对线，等 anomalyco/models.dev 的真人 maintainer review（截至 2026-07-27 仍只有机器人评论，无真人 review）
- [ ] PR 合并后确认 opencode 里只设 `MUIROUTER_API_KEY` 就能刷出模型
- [ ] PR 合并后把 `/opencode` 页改成「只设 MUIROUTER_API_KEY 即可」，手写片段降为附录
- [ ] `mimo-v2.5-flash` 补元数据：models.dev 无条目，小米公开文档也查不到 context 长度与发布日期，拿到后填进 `fetch-model-metadata.ts` 的 `MANUAL_METADATA`

**发新模型的 checklist 追加一条**：加模型 / 调价后重跑 `gen-models-dev-toml.ts --remote` 并向 models.dev 再提一次 PR，否则 opencode 用户看不到新模型。

## Claude Opus 5 接入（2026-07-25）

- [x] `seed.ts` / `seed-models.sql` 增加 `claude-opus-5`（$5/$25，cache 0.5/6.25，markup 1.05）
- [x] 博客 8 语种 + `blog-content.ts` 注册
- [x] 不写 drizzle migration：生产直接跑 INSERT SQL
- [x] 生产 D1 插入 model + blog 元数据（wrangler d1 --remote）
- [x] 清 KV `models:catalog`
- [x] 线上确认 `/zh/blog/claude-opus-5` 200

## GPT-5.6 降价博客（2026-07-31）

- [x] 从 X (Twitter)、Reddit、Hacker News 等收集 10+ 个不同角度的开发者讨论与社区总结
- [x] 精炼归纳 3 大核心社区观点，并融入 Gemini 3.6 Flash 质量倒退、1M 上下文、Agent 专属微调及应对中国开源竞争等独到视角
- [x] 撰写并优化中文博客草稿 `packages/dashboard/src/content/blog/gpt-5-6-price-cut.zh.mdx`
## DeepSeek V4 Flash 接入与 OpenCode Go 对接（2026-08-02）

- [x] `packages/app/src/types.ts` 补充 `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL`
- [x] `provider-dispatch.ts` 添加 `callDeepSeek` 直连分发
- [x] `usage-extractor.ts` 增加 `deepseek` 用量提取分支
- [x] `routes/openai.ts` 添加 `deepseek` 路由分支
- [x] `seed.ts` 增加 `deepseek-v4-flash` 模型配置（$0.14/$0.28，cache $0.0028）
- [x] `fetch-model-metadata.ts` 录入 `deepseek-v4-flash` 元数据
- [x] 编写并优化博客草稿 `packages/dashboard/src/content/blog/deepseek-v4-flash.zh.mdx`（及英文版）并注册 `blog-content.ts`
- [x] 运行格式化、类型检查和单元测试（308 个测试全部通过）

## OpenCode Go API 端点对接与 OPENCODE_GO_API_KEY 鉴权（2026-08-02）

- [x] `packages/app/src/types.ts` 补充 `OPENCODE_GO_API_KEY` / `OPENCODE_GO_BASE_URL`
- [x] `provider-dispatch.ts` 添加 `callOpenCodeGo` 分发逻辑，并在 `callDeepSeek` / `callMoonshot` / `callXiaomiMiMo` 中支持当原厂 Key 缺失时自动降级回退至 `OPENCODE_GO_API_KEY`
- [x] 删除 drizzle schema 迁移文件，保持纯 Schema 迁移规则
- [x] 编写 `scripts/insert-deepseek-v4-flash.sql`（包含 `models` + `blog_posts` + 8 语种 `blog_post_translations`）用于线上 D1 执行
- [x] 同步更新并重新生成 `seed-models.sql` (基于 `packages/app/src/db/seed.ts`)






