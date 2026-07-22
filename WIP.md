# WIP

充值"未到账"与手动充值记录不可见的修复已全部完成(2026-07-22):

- 代码修复 6 提交 + 遗留 Stripe 集成清理 1 提交,已 push(d1dba02)触发自动部署
- 生产迁移 0022_drop_wallets 已应用(空表删除)
- 涉事用户(3290307575@qq.com)KV 镜像已修正为权威余额 26.4419764
- 历史手动充值已按"余额+消费"反推补录 4 条(source='backfill'):
  3290307575@qq.com $29.05 / ffxk007@126.com $43.54 / meathill@gmail.com $10.00 / stefan_ysh@foxmail.com $17.44

## 待用户确认

- [ ] 确认 Cloudflare 自动部署完成(mui-api 与 dashboard)
- [ ] dashboard 用户页 / Recharge Logs 核对余额与补录记录显示
- [ ] 通知付费用户余额已到账
- [ ] 给自己账号手动充 $1,验证新充值即时出现在 Recharge Logs(带 operator)
- [ ] Stripe Dashboard 核对:webhook 只指向 dashboard 的 /api/stripe/webhook,且订阅了 checkout.session.async_payment_succeeded(旧 /webhooks/stripe 端点如有配置请删除)

## 上一轮遗留

2026-07-21 OpenAI 兼容性修复已完成,待用户用 opencode 实连复验。
