# WIP

## 进行中（已停靠 feat-union 分支，2026-09-05 维护轮次）

- **GA4 关键事件（issue #13）**：代码已完成，停靠 feat-union（提交 c95331e）。合入部署后按 `docs/ga4-key-events.md` 做 DebugView 验证与后台关键事件标记。
- **AI 自主接入控制面**：未完成，停靠 feat-union（提交 18d14db，任务清单见该提交的 WIP.md）。恢复开发：`git rebase --onto master fab78f8 feat-union`。
- ⚠️ 合并前需重命名 feat-union 的 `packages/shared-db/drizzle/0028_integration_control.sql` → `0029_*`：master 已有 `0028_add_terms_consent.sql`，撞号会破坏迁移顺序。
