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
  - **待你确认**：`gemini-3-flash-preview` 与 `gemini-3.1-pro-preview` 价格完全相同（input=2, output=12），机器人连续两轮点出，很可能是后台录入时复制粘贴出的错，需要去 `/admin/models` 或 D1 核对
  - **待实测**：Claude 模型的 `reasoning_options` 是否准确——取决于 CF AI Gateway 把 OpenAI 风格 `reasoning_effort` 转成 Anthropic `thinking.budget_tokens` 的内部逻辑，代码库里查不到，需要真实调一次 API 验证
  - 现在按你的决定：先不继续跟机器人对线，等 anomalyco/models.dev 的真人 maintainer review
- [ ] PR 合并后确认 opencode 里只设 `MUIROUTER_API_KEY` 就能刷出模型
- [ ] PR 合并后把 `/opencode` 页改成「只设 MUIROUTER_API_KEY 即可」，手写片段降为附录
- [ ] `mimo-v2.5-flash` 补元数据：models.dev 无条目，小米公开文档也查不到 context 长度与发布日期，拿到后填进 `fetch-model-metadata.ts` 的 `MANUAL_METADATA`
- [ ] 可选：models.dev 的 `logo.svg`（品牌资产需人工决定，脚本不生成）

**发新模型的 checklist 追加一条**：加模型 / 调价后重跑 `gen-models-dev-toml.ts --remote` 并向 models.dev 再提一次 PR，否则 opencode 用户看不到新模型。

## Claude Opus 5 接入（2026-07-25）

- [x] `seed.ts` / `seed-models.sql` 增加 `claude-opus-5`（$5/$25，cache 0.5/6.25，markup 1.05）
- [x] 博客 8 语种 + `blog-content.ts` 注册
- [x] 不写 drizzle migration：生产直接跑 INSERT SQL
- [x] 生产 D1 插入 model + blog 元数据（wrangler d1 --remote）
- [x] 清 KV `models:catalog`
- [x] 线上确认 `/zh/blog/claude-opus-5` 200

## 充值遗留（上一轮）

- [ ] 确认 Cloudflare 自动部署完成(mui-api 与 dashboard)
- [ ] dashboard 用户页 / Recharge Logs 核对余额与补录记录显示
- [ ] 通知付费用户余额已到账
