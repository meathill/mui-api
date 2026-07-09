# WIP

当前没有进行中的开发任务。

> 接入 xAI Grok（2026-07-09）已归档：经 CF AI Gateway 接入聊天补全（`grok-4.3`/`grok-4.5`）+ 图片生成（`grok-imagine-image`）。xAI key 以 Stored Keys 形式配置在 CF AI Gateway 后台，本服务不持有真实 key（`callGrokEndpoint()` 只带 `cf-aig-authorization`），接入模式与 openai/google-ai-studio 一致，不是 BYOK。图片计费按返回数量兜底（`extractGrokImageUsage`，官方未确认响应是否带 usage 字段）。markupRate 统一 1.05。种子数据已用 `print-seed-sql.ts` 生成 SQL 应用到远程 D1，并清了 KV `models:catalog` 缓存，模型已可查询。视频生成（异步任务模型，需要新的任务状态追踪子系统）拆成 [#5](https://github.com/meathill/mui-api/issues/5) 独立跟踪。format/typecheck/test/test:e2e/build 全绿。**待人工**：① 用一次真实调用核实 chat/image 响应 usage 字段形状是否与假设一致（尤其图片生成，若实际带 usage 需把 `extractGrokImageUsage` 改走标准解析）；② 对照 x.ai 官方定价页核实 `seed.ts` 里三条模型的 `inputPrice`/`outputPrice` 后去掉"待审核"注释，若有调整需重新应用 seed。详见 DEV_NOTE.md「xAI Grok 接入」一节。

> Claude 全量切 BYOK（2026-07-08）已归档：排查中发现 CF Gateway 后台早有 `anthropic` Stored Key 在生效（流量已实际用自付账户出钱），代码层 `ANTHROPIC_CREDENTIAL_MODE=byok` 补齐作保险丝，避免这个未版本控制的开关成为唯一依赖；markupRate 1.1→1.05；smoke 脚本新增 byok compat 腿（Leg D）、远程 D1 seed 应用、KV 缓存清理、部署均已完成；AWS Bedrock 直连方案设计后搁置（详见 DEV_NOTE.md）。

> Claude Fable 5 下线（2026-07）已验收归档：远程 D1 seed 应用、KV 目录缓存清理、smoke 验证均已完成。
