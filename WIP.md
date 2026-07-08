# WIP

当前没有进行中的开发任务。

> Claude 全量切 BYOK（2026-07-08）已归档：排查中发现 CF Gateway 后台早有 `anthropic` Stored Key 在生效（流量已实际用自付账户出钱），代码层 `ANTHROPIC_CREDENTIAL_MODE=byok` 补齐作保险丝，避免这个未版本控制的开关成为唯一依赖；markupRate 1.1→1.05；smoke 脚本新增 byok compat 腿（Leg D）、远程 D1 seed 应用、KV 缓存清理、部署均已完成；AWS Bedrock 直连方案设计后搁置（详见 DEV_NOTE.md）。

> Claude Fable 5 下线（2026-07）已验收归档：远程 D1 seed 应用、KV 目录缓存清理、smoke 验证均已完成。
