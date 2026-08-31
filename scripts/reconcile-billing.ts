/**
 * 只读对账脚本：按 userId + 8/30+8/31 两日窗口，输出 D1 usage_logs 的分模型/分 provider 明细
 * 覆盖：Grok / Claude (anthropic) / DeepSeek（含经 OpenCode Go 劫持的部分）
 *
 * 用法（需本地已 `wrangler login`，不写入任何数据；Node.js 26 原生支持 .ts，无需 tsx/ts-node）：
 *  - 完整两日 UTC：node scripts/reconcile-billing.ts --user hHMqR5nutGAq0m5ixwH5X0hqtytil61Q
 *  - 指定窗口   ：node scripts/reconcile-billing.ts --user <id> --from 2026-08-30 --to 2026-09-01 --tz UTC
 *  - CST 双档   ：node scripts/reconcile-billing.ts --user <id> --tz CST
 *
 * 依赖：Node >= 26 原生跑 .ts（无需 tsc/tsx），读取 wrangler.jsonc 中的 database_id。
 * 输出：stdout 表格 + 可复制的 wrangler D1 / KV / tail 命令。
 */

function parseArgs() {
  const raw = process.argv.slice(2);
  const args = raw.filter((a) => a !== '--');
  const get = (k: string, fallback?: string) => {
    const idx = args.indexOf(`--${k}`);
    return idx >= 0 ? args[idx + 1] : fallback;
  };
  const isAll = args.includes('--all');
  const userId = get('user', get('userId', '')) ?? '';
  if (!isAll && !userId) {
    console.error(
      '缺少 --user <userId>，示例：node scripts/reconcile-billing.ts --user hHMqR5nutGAq0m5ixwH5X0hqtytil61Q\n或全站：node scripts/reconcile-billing.ts --all',
    );
    process.exit(1);
  }
  const from = get('from', '2026-08-30')!;
  const to = get('to', '2026-09-01')!;
  const tzRaw = get('tz', 'UTC') ?? 'UTC';
  const tz = tzRaw === 'CST' ? 'CST' : 'UTC';
  const remote = get('remote', 'true') !== 'false';
  return { userId: userId || '__ALL__', isAll, from, to, tz, remote };
}

function toUnixepochWhere(from, to, tz) {
  // D1 的 unixepoch 接受修饰符，CST = +8 hours
  const tzMod = tz === 'CST' ? `,'+8 hours'` : '';
  const where = `created_at >= unixepoch('${from} 00:00:00'${tzMod}) AND created_at < unixepoch('${to} 00:00:00'${tzMod})`;
  const label = `${from} ~ ${to} (${tz})`;
  return { where, label };
}

async function getDatabaseId() {
  const { readFile } = await import('node:fs/promises');
  const raw = await readFile(new URL('../packages/app/wrangler.jsonc', import.meta.url), 'utf8');
  // wrangler.jsonc 含注释，粗解析 database_id
  const m = raw.match(/"database_id"\s*:\s*"([^"]+)"/);
  if (!m) throw new Error('未在 packages/app/wrangler.jsonc 找到 database_id');
  return m[1];
}

async function execD1(query, remote, dbId) {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    const args = ['d1', 'execute', 'mui-api', `--command=${query}`, '--json'];
    if (remote) args.push('--remote');
    // 显式传 database_id 避免 wrangler 按 name 解析歧义
    const child = spawn('npx', ['wrangler', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`wrangler d1 execute 失败 code=${code}\n${err}\n${out}`));
        return;
      }
      try {
        resolve(JSON.parse(out));
      } catch {
        resolve(out);
      }
    });
  });
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  const { userId, isAll, from, to, tz, remote } = parseArgs();
  const { where, label } = toUnixepochWhere(from, to, tz);
  const dbId = await getDatabaseId();
  const userFilter = isAll ? '' : `user_id='${userId}' AND `;
  const scopeLabel = isAll ? '对账范围: 全站（不限制 user_id）' : `对账用户: ${userId}`;

  console.log(scopeLabel);
  console.log(`窗口: ${label}  (D1 where: ${where})`);
  console.log(`数据库: mui-api (${dbId}) ${remote ? '--remote' : '--local'}`);

  // 1. 分模型明细 — 列名用 snake_case（D1 真实列名）
  const qByModel = `SELECT model_id as modelId, tier, count(*) as cnt, sum(input_tokens) as it, sum(cached_input_tokens) as cit, sum(cache_write_tokens) as cwt, sum(output_tokens) as ot, sum(cost) as totalCost FROM usage_logs WHERE ${userFilter}${where} GROUP BY model_id, tier ORDER BY totalCost DESC;`;
  printSection('1. 分模型+分 tier 明细（usage_logs.cost 求和 = 真实成本，非 chargedCost）');
  console.log(qByModel);
  try {
    const r1 = await execD1(qByModel, remote, dbId);
    console.log(JSON.stringify(r1, null, 2));
  } catch (e) {
    console.error(String(e));
  }

  // 2. 分 provider 汇总（需 join models）
  const qByProvider = `SELECT m.provider as provider, count(*) as cnt, sum(u.cost) as totalCost, sum(u.input_tokens) as it, sum(u.cached_input_tokens) as cit, sum(u.cache_write_tokens) as cwt, sum(u.output_tokens) as ot FROM usage_logs u LEFT JOIN models m ON m.id=u.model_id WHERE ${userFilter}${where} GROUP BY m.provider ORDER BY totalCost DESC;`;
  printSection('2. 分 provider 汇总（LEFT JOIN models，provider 为空表示 models 缺行，回退到 gpt-4o-mini 定价）');
  console.log(qByProvider);
  try {
    const r2 = await execD1(qByProvider, remote, dbId);
    console.log(JSON.stringify(r2, null, 2));
  } catch (e) {
    console.error(String(e));
  }

  // 3. 模型表完整性（Grok/Claude/DeepSeek）
  const qModels = `SELECT id, provider, input_price as inputPrice, output_price as outputPrice, markup_rate as markupRate, cached_input_price as cachedInputPrice, cache_write_price as cacheWritePrice FROM models WHERE id IN ('grok-4.6','grok-4.5','grok-4.3','claude-sonnet-4-6','claude-haiku-4-5','claude-opus-4-6','claude-opus-4-8','deepseek-v4-pro','deepseek-v4-flash') ORDER BY provider, id;`;
  printSection('3. 模型表完整性（若缺行，billing-service 会回退 gpt-4o-mini 0.15/0.6 导致严重低估）');
  console.log(qModels);
  try {
    const r3 = await execD1(qModels, remote, dbId);
    console.log(JSON.stringify(r3, null, 2));
  } catch (e) {
    console.error(String(e));
  }

  // 4. 两日合计与单日拆分（便于与原厂账单逐日对齐）
  const qDaily = `SELECT date(created_at, 'unixepoch'${tz === 'CST' ? ", '+8 hours'" : ''}) as day, count(*) as cnt, sum(cost) as totalCost FROM usage_logs WHERE ${userFilter}${where} GROUP BY day ORDER BY day;`;
  printSection('4. 按日拆分（便于与 8/30、8/31 原厂账单逐日对齐）');
  console.log(qDaily);
  try {
    const r4 = await execD1(qDaily, remote, dbId);
    console.log(JSON.stringify(r4, null, 2));
  } catch (e) {
    console.error(String(e));
  }

  // 4b. Anthropic 缓存细分（定位 H1 是否为 cache 未计费；若 cit/cwt 全 0 但原厂 cache 占比高→解析漏）
  const qAnthropicCache = `SELECT model_id as modelId, count(*) as cnt, sum(input_tokens) as it, sum(cached_input_tokens) as cit, sum(cache_write_tokens) as cwt, sum(output_tokens) as ot, sum(cost) as totalCost FROM usage_logs WHERE ${userFilter}${where} AND model_id LIKE 'claude%' GROUP BY model_id ORDER BY totalCost DESC;`;
  printSection(
    '4b. Anthropic 缓存细分（cit=cache_read, cwt=cache_creation；若全 0 但原厂账单 cache 占比高→H1 解析漏）',
  );
  console.log(qAnthropicCache);
  try {
    const r4b = await execD1(qAnthropicCache, remote, dbId);
    console.log(JSON.stringify(r4b, null, 2));
  } catch (e) {
    console.error(String(e));
  }

  // 4c. Grok 文本 vs 图像/视频拆分（Grok 控制台 $2.92 通常仅含文本，图像/视频另计；内部 $5.6 含图像/视频）
  const qGrokSplit = `SELECT CASE WHEN model_id LIKE 'grok-imagine%' THEN 'grok-image-video' WHEN model_id LIKE 'grok%' THEN 'grok-text' ELSE 'other' END as grokKind, count(*) as cnt, sum(cost) as totalCost FROM usage_logs WHERE ${userFilter}${where} AND model_id LIKE 'grok%' GROUP BY grokKind ORDER BY totalCost DESC;`;
  printSection(
    '4c. Grok 文本/图像拆分（grok-text vs grok-image-video；与 Grok 控制台 $2.92 口径对齐时应看 grok-text）',
  );
  console.log(qGrokSplit);
  try {
    const r4c = await execD1(qGrokSplit, remote, dbId);
    console.log(JSON.stringify(r4c, null, 2));
  } catch (e) {
    console.error(String(e));
  }

  // 4d. Grok 视频任务表（video_generation_jobs）— 真实提交数 vs usage_logs 已结算数
  // usage_logs 仅在 GET /v1/videos/:id 轮询到 done 时插入；pending 的 11 条不会出现在 1/2 中，Grok 控制台按提交计 16 条
  const qVideoJobs = `SELECT status, count(*) as cnt, sum(estimated_cost) as estCost, sum(actual_cost) as actualCost, sum(settled_cost) as settledCost FROM video_generation_jobs WHERE ${userFilter}${where} GROUP BY status ORDER BY status;`;
  printSection(
    '4d. Grok 视频任务表（video_generation_jobs：提交 16 vs 已结算 5 的差额即漏计；pending 的估算成本需计入总额）',
  );
  console.log(qVideoJobs);
  try {
    const r4d = await execD1(qVideoJobs, remote, dbId);
    console.log(JSON.stringify(r4d, null, 2));
  } catch (e) {
    console.error(String(e));
  }
  const qVideoJobsTotal = `SELECT count(*) as totalJobs, sum(CASE WHEN status='done' THEN 1 ELSE 0 END) as doneJobs, sum(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pendingJobs, sum(estimated_cost) as totalEstimated, sum(settled_cost) as totalSettled FROM video_generation_jobs WHERE ${userFilter}${where};`;
  printSection('4e. 视频任务汇总（totalJobs=Grok 控制台口径；totalSettled=已计入 usage_logs 的；差额=未轮询到 done）');
  console.log(qVideoJobsTotal);
  try {
    const r4e = await execD1(qVideoJobsTotal, remote, dbId);
    console.log(JSON.stringify(r4e, null, 2));
  } catch (e) {
    console.error(String(e));
  }

  // 5. 可复制的辅助命令
  printSection('5. 可复制的辅助命令（本地执行，不写入）');
  if (!isAll) {
    console.log(`# KV 镜像（余额 / freeQuotaUsed）\nwrangler kv key get --binding=KV --remote "user:${userId}" | jq .`);
  } else {
    console.log(`# 全站模式：不查单用户 KV`);
  }
  console.log(
    `\n# WalletDO 真账本（需部署后，本地 dev 无法跨 Worker 绑定）\n# wrangler 会经由 /admin/sync-wallet-mirror 触发 sync，详见 DEV_NOTE.md wallet 一节`,
  );
  console.log(
    `\n# tail 计费失败（8/30-31 窗口内搜索）\nwrangler tail mui-api --format json | grep -E "计费失败|原生代理.*失败|usage 提取失败|模型 .* 无定价|\\[billing\\]"`,
  );
  const cstCmd = isAll
    ? `node scripts/reconcile-billing.ts --all --from ${from} --to ${to} --tz CST`
    : `node scripts/reconcile-billing.ts --user ${userId} --from ${from} --to ${to} --tz CST`;
  console.log(`\n# CST 档复核（与 UTC 对照，排除时区差一天）\n` + cstCmd);
  console.log(`\n# 报表解读：`);
  console.log(
    `- 若 “2. 分 provider” 中 Grok+Claude+DeepSeek 的 sum(totalCost) ≈ 3.7 且 cnt 显著小于原厂请求数 → H1 异步丢失`,
  );
  console.log(`- 若某 provider 的 provider 为 NULL 或 cnt>0 但 totalCost 极小 → H2 定价缺行回退`);
  console.log(`- 若 DeepSeek cnt=0 但 DeepSeek 控制台/Go 后台有量 → H3 Go shape 不兼容导致跳过计费`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
