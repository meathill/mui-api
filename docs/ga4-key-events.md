# GA4 关键事件（Issue #13）：定义、上线与验证手册

属性：`muirouter`，衡量 ID `G-JLM9L0BTTV`（见 `packages/dashboard/src/lib/analytics.ts` 的 `GA_MEASUREMENT_ID`）。

## 1. 事件定义

| 事件 | 类型 | 触发点 | 去重 |
|------|------|--------|------|
| `sign_up`（`method=email\|github\|google`） | GA4 推荐 | 邮箱注册成功页直接发；社交登录点击记 pending，dashboard 侧按账号创建时间（30 分钟内）补发 | localStorage 一次性 |
| `api_key_created` | 自定义 | `/keys` 创建成功 | 每次创建都发（天然低频） |
| `playground_first_run`（`mode`/`model`） | 自定义 | Playground 四种模式首次成功返回 | localStorage 一次性 |
| `begin_checkout`（`value`/`currency=USD`） | GA4 推荐 | 点击充值、跳转 Stripe 前 | 每次点击都发 |
| `purchase`（`transaction_id`=checkout session id） | GA4 推荐 | 充值到账轮询到 `credited` | localStorage + `transaction_id` 双重 |

归因：单域名（`muirouter.com`），无需跨域 linker；登录前后靠同一 `_ga` client_id + 登录后 `gtag('set', {user_id})`（`AnalyticsIdentity`）连接。

Consent：Consent Mode v2，默认 `denied`（内联脚本先于 gtag 执行，已同意的老用户直接恢复 `granted`）；横幅在 `CookieConsentBanner`，文案走 `consent` namespace（8 语言）。拒绝后 GA 只发 cookieless ping，功能不受影响。

## 2. GA4 后台操作（上线后人工执行一次）

1. **标记关键事件**：管理 → 数据显示 → 关键事件 → 新建关键事件，逐个添加 `sign_up`、`api_key_created`、`playground_first_run`、`begin_checkout`、`purchase`（新事件首次上报后 24 小时内才会出现在列表，没有就先走第 3 步触发一次）。
2. **DebugView 验证**：GA4 左侧 配置 → DebugView；本地 `?debug_mode=1` 或装 Google Analytics Debugger 扩展，按顺序触发注册→建 Key→Playground→充值，确认事件与参数（`method`/`mode`/`model`/`transaction_id`）正确，且重复触发时一次性事件不再上报。
3. **漏斗复核（Organic 归因）**：探索 → 漏斗探索，分步 `session_start` → `sign_up` → `api_key_created` → `playground_first_run` → `purchase`，细分加上`会话来源/媒介 = organic`，对比落地页报表（`着陆页 + 查询字符串`维度）确认自然搜索页带来转化。

## 3. 口径警告（必读）

- GA4 事件数 ≠ 付费/收入：`purchase` 只是前端轮询到到账后上报的信号，可能因关闭页面、拦截器、consent 拒绝而漏报；**收入以 Stripe 对账与 D1 `recharge_logs` 为准**。
- `sign_up` 是浏览器级去重（localStorage），换浏览器/清缓存会重复；**注册数以 `user` 表为准**。
- 同意横幅拒绝的用户行为不可见，Organic 转化率会被系统性低估——看趋势，不看绝对值。
