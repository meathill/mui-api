# WIP

## Claude Opus 5 接入（2026-07-25）

- [x] `seed.ts` / `seed-models.sql` 增加 `claude-opus-5`（$5/$25，cache 0.5/6.25，markup 1.05）
- [x] 博客 8 语种 + `blog-content.ts` 注册
- [x] 不写 drizzle migration：生产直接跑 INSERT SQL
- [ ] 生产 D1 插入 model + blog 元数据
- [ ] 清 KV `models:catalog`
- [ ] 部署确认 `claude-opus-5` 可用

## 充值遗留（上一轮）

- [ ] 确认 Cloudflare 自动部署完成(mui-api 与 dashboard)
- [ ] dashboard 用户页 / Recharge Logs 核对余额与补录记录显示
- [ ] 通知付费用户余额已到账
