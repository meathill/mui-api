# WIP

当前没有进行中的开发任务。

> Kimi K3 发布文章（2026-07-17）已归档：按用户确认的中文稿补齐 8 语言 MDX，新增 `0021_add_kimi_k3_post.sql`、正文 loader、博客与 sitemap E2E；本地/生产 D1 migration 均已应用。MDX 编译、format、全仓 typecheck、Dashboard 单测（78 项）、Playwright（37 项）和 production build 全绿；Dashboard 生产版本 `9366a784-340d-4674-8eb5-3860b8f072af` 已上线，8 语言文章、博客列表与 sitemap 均验收通过。本次未提交 IndexNow。

> Kimi K3 产品完整接入（2026-07-17）已归档：新增 `moonshot` 直连 provider、`kimi-k3` 1M context 模型、Kimi 流式/非流式 cache usage 计费、`0020` migration、Playground 视觉输入与 reasoning 展示、首页/定价页/Admin/8 语言内容；本地 migration、format、typecheck、App/Dashboard 单测、API E2E、Dashboard Playwright 和两个 production build 全绿。生产 secret、部署、远程 migration、KV 清理、线上 smoke 与 push 在代码提交后执行。

> GPT-5.6 模型目录接入（2026-07-12）已归档：`seed.ts` 增加 `gpt-5.6-sol` / `gpt-5.6` / `gpt-5.6-terra` / `gpt-5.6-luna`（官方 $5/$30、$2.5/$15、$1/$6；cache write 1.25×）；migration `0019` 已应用本地 + 远程 D1；生产 KV `models:catalog` 已清除；IndexNow 提交 120 条 URL（202）。format/typecheck/单测绿。**说明**：网关路由已走 openai provider，真实调用取决于 CF AI Gateway 上游是否已开通这些 model id。

> Grok 异步视频生成与 Playground（issue #5，2026-07-12）已归档：新增 `grok-imagine-video` / `grok-imagine-video-1.5` 共享能力和定价、D1 `video_generation_jobs`、`WalletDO` 原子预占/续期/结算/释放、视频提交与归属轮询 API、ticks 优先且以授权金额封顶的幂等计费，以及 Playground 视频参数、单图上传、3 秒轮询、中止恢复、播放/保存和本地历史。migration `0018` 已应用本地与生产。format、全仓 typecheck、app/dashboard 单测、app E2E、app/dashboard build 全绿；Dashboard Playwright 因 Chromium 1208 缺失未运行。

> Grok 生图内部 Token 适配（2026-07-11）已归档：新增共享 `@muirouter/shared-db/grok-image` 配置与 `grok-imagine-image-quality`；xAI `cost_in_usd_ticks` 按 `ticks / 10,000` 换算内部 output token，缺失 ticks 时按模型、参考图数量、输出数量和分辨率兜底；Grok 生成支持数量/宽高比/1K、2K，编辑支持 JSON 单图与最多 3 张多图；Playground 已提供对应控件、Base64 编辑、真实按图价格、8 语言文案与历史恢复。`0017_update_grok_image_models.sql` 已应用本地和生产 D1，生产 KV `models:catalog` 已清除。format、typecheck、app/dashboard 单测、app E2E、app/dashboard build 全绿。

> GPT-5.6 首页与更新文章（2026-07-11）已归档：首页 OpenAI 卡片改为 Sol/Terra/Luna；新增博客 `gpt-5-6`（8 语言 MDX，中文改口吻后已同步其它语种 + `0016_add_gpt_5_6_post.sql` + blog-content loaders）；e2e/sitemap 同步。远程 + 本地 D1 migration `0016` 已应用；线上 `/` 与 `/blog/gpt-5-6` 已验收；IndexNow 已在目录接入任务中一并提交。

> 修复 issue #4：muirouter.com 接入 IndexNow（2026-07-10）已归档：新增 `packages/dashboard/public/016b4167fcb47ccc6332fc9ab8a242ab.txt`（IndexNow key 文件，非 secret）与 `scripts/submit-indexnow.ts`（`scripts/indexnow.ts` 纯函数 + 单测），支持手动向 `api.indexnow.org` 提交 sitemap 全量 URL；顺手修复 `.github/workflows/ci.yml` 的 `--filter dashboard` 从未匹配到 `mui-api-dashboard` 导致 `dashboard-e2e` job 一直静默跳过的 bug；顺带修复 `tsconfig.json` 缺少 `allowImportingTsExtensions` 导致纯 node 脚本 typecheck 报 `TS5097` 的问题。format/typecheck（3 个包全绿）/单测（8 files 64 tests 全绿）/build 均已验证；对线上 `https://muirouter.com/sitemap.xml` 做过 `--dry-run` 冒烟（识别出 112 条 URL）；key 文件已用本地 dev server 直接 fetch 验证返回 200 且 body 精确匹配。**待人工**：① 本沙箱环境 Playwright Chromium 下载被卡住（网络原因，非代码问题），未能跑通本地/CI 的 `test:e2e`，建议合并前在正常网络环境跑一次 `pnpm --dir packages/dashboard run test:e2e` 确认新增用例、以及首次被 CI filter 修复"唤醒"的既有用例（`auth.test.ts`/`dashboard.test.ts`/`marketing.test.ts`）全部通过；② 部署上线后：确认 key 文件线上 200、执行真实 `pnpm --dir packages/dashboard run submit:indexnow`、在 Bing Webmaster 重新提交 sitemap、跑 URL Inspection，见 [issue #4](https://github.com/meathill/mui-api/issues/4)。详见 DEV_NOTE.md「IndexNow 手动提交脚本」一节。
