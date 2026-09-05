/**
 * 只读诊断脚本：排查某用户 Claude 流量 prompt cache 零命中的原因。
 *
 * 背景：Anthropic 的 prompt cache 需要请求体里显式带 cache_control 断点（OpenAI 是自动缓存，
 * Anthropic 不是），且要求前缀一致、≥1024 token（haiku 2048）、默认 5min TTL。
 * 平台两条入口对缓存的支持不同：
 *  - /v1/messages（原生）：cache_control 可透传 → 是否命中取决于客户端写法
 *  - /v1/chat/completions（OpenAI 兼容 → CF 网关 compat 端点）：OpenAI 格式没有 cache_control
 *    的位置，请求结构性无法建缓存 → cit/cwt 恒 0
 *
 * 判定逻辑（按 usage_logs 的 cit=cached_input_tokens / cwt=cache_write_tokens 二分）：
 *  - cwt=0 且 cit=0 → 请求里没有任何缓存断点生效 → 走 compat 入口（平台结构限制）或客户端没写 cache_control
 *  - cwt>0 且 cit=0 → 断点生效但从未命中 → 前缀不稳定或请求间隔超 5min TTL（客户使用方式问题）
 *  - cit>0 → 有命中，属命中率优化问题
 *
 * 用法（需本地已 `wrangler login`，纯只读；Node >= 26 原生跑 .ts）：
 *  - node scripts/diagnose-claude-cache.ts --user <userId>
 *  - 指定窗口：node scripts/diagnose-claude-cache.ts --user <id> --from 2026-08-27 --to 2026-09-03 --tz CST
 *  - 全站：node scripts/diagnose-claude-cache.ts --all
 */

interface D1Result {
  results?: Record<string, unknown>[];
  success?: boolean;
}

interface UsageRow {
  created_at: number;
  model_id: string;
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  cost: number;
}

const CACHE_MIN_TOKENS = 1024; // haiku 系列为 2048，报告里单独提示
const TTL_SECONDS = 300; // Anthropic 默认缓存 TTL

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
    console.error('缺少 --user <userId>，示例：node scripts/diagnose-claude-cache.ts --user <id>\n或全站：--all');
    process.exit(1);
  }
  const today = new Date().toISOString().slice(0, 10);
  const from = get('from', '2026-08-27')!;
  const to = get('to', today)!;
  const tzRaw = get('tz', 'CST') ?? 'CST';
  const remote = get('remote', 'true') !== 'false';
  return { userId: userId || '__ALL__', isAll, from, to, tz: tzRaw === 'UTC' ? 'UTC' : 'CST', remote };
}

function toUnixepochWhere(from: string, to: string, tz: 'UTC' | 'CST'): string {
  const tzMod = tz === 'CST' ? `,'+8 hours'` : '';
  return `created_at >= unixepoch('${from} 00:00:00'${tzMod}) AND created_at < unixepoch('${to} 00:00:00'${tzMod})`;
}

async function getDatabaseId(): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  const raw = await readFile(new URL('../packages/app/wrangler.jsonc', import.meta.url), 'utf8');
  const m = raw.match(/"database_id"\s*:\s*"([^"]+)"/);
  if (!m) throw new Error('未在 packages/app/wrangler.jsonc 找到 database_id');
  return m[1];
}

async function execD1(query: string, remote: boolean): Promise<Record<string, unknown>[]> {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    const args = ['d1', 'execute', 'mui-api', `--command=${query}`, '--json'];
    if (remote) args.push('--remote');
    const child = spawn('npx', ['wrangler', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`wrangler d1 execute 失败 code=${code}\n${err}\n${out}`));
        return;
      }
      try {
        const parsed: unknown = JSON.parse(out);
        // wrangler --json 输出兼容两种形态：[{results}] 或 {results}
        const first = Array.isArray(parsed) ? parsed[0] : parsed;
        resolve(((first as D1Result | undefined)?.results ?? []) as Record<string, unknown>[]);
      } catch {
        reject(new Error(`wrangler 输出不是 JSON：${out.slice(0, 500)}`));
      }
    });
  });
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function printTable(headers: string[], rows: string[][]) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]?.length ?? 0)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
  console.log(line(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(line(r));
}

async function main() {
  const { userId, isAll, from, to, tz, remote } = parseArgs();
  const where = toUnixepochWhere(from, to, tz);
  const userFilter = isAll ? '' : `user_id='${userId.replaceAll("'", '')}' AND `;
  const claudeWhere = `${userFilter}${where} AND model_id LIKE 'claude%'`;
  const scope = isAll ? '全站' : `用户 ${userId}`;

  console.log(`Claude 缓存诊断: ${scope}`);
  console.log(`窗口: ${from} ~ ${to} (${tz})  ${remote ? '--remote' : '--local'}`);

  // 1. 分日 + 分模型明细
  const qDaily = `SELECT date(created_at, 'unixepoch'${tz === 'CST' ? ", '+8 hours'" : ''}) as day, model_id, count(*) as cnt, sum(input_tokens) as it, sum(cached_input_tokens) as cit, sum(cache_write_tokens) as cwt, sum(output_tokens) as ot, round(sum(cost), 4) as cost FROM usage_logs WHERE ${claudeWhere} GROUP BY day, model_id ORDER BY day, cost DESC;`;
  const daily = await execD1(qDaily, remote);
  console.log('\n=== 1. 分日 × 分模型（it=普通输入 cit=缓存读 cwt=缓存写，单均 input=it/cnt）===');
  printTable(
    ['day', 'model', 'cnt', 'avg_input', 'it', 'cit', 'cwt', 'ot', 'cost$'],
    daily.map((r) => [
      String(r.day ?? ''),
      String(r.model_id ?? ''),
      fmt(num(r.cnt)),
      fmt(Math.round(num(r.it) / Math.max(1, num(r.cnt)))),
      fmt(num(r.it)),
      fmt(num(r.cit)),
      fmt(num(r.cwt)),
      fmt(num(r.ot)),
      String(r.cost ?? ''),
    ]),
  );

  // 2. 请求级缓存形态分布（判定核心）
  const qShape = `SELECT count(*) as cnt, sum(CASE WHEN cached_input_tokens=0 AND cache_write_tokens=0 THEN 1 ELSE 0 END) as zeroCache, sum(CASE WHEN cache_write_tokens>0 AND cached_input_tokens=0 THEN 1 ELSE 0 END) as writeOnly, sum(CASE WHEN cached_input_tokens>0 THEN 1 ELSE 0 END) as hasHit FROM usage_logs WHERE ${claudeWhere};`;
  const [shape] = await execD1(qShape, remote);
  const total = num(shape?.cnt);
  const zeroCache = num(shape?.zeroCache);
  const writeOnly = num(shape?.writeOnly);
  const hasHit = num(shape?.hasHit);
  console.log('\n=== 2. 缓存形态分布（判定核心）===');
  printTable(
    ['形态', '请求数', '占比', '含义'],
    [
      [
        '零缓存(0/0)',
        fmt(zeroCache),
        `${Math.round((zeroCache / Math.max(1, total)) * 100)}%`,
        '无断点生效：compat 入口 或 客户端没写 cache_control',
      ],
      [
        '只写不读(+/0)',
        fmt(writeOnly),
        `${Math.round((writeOnly / Math.max(1, total)) * 100)}%`,
        '断点生效但从未命中：前缀不稳定 或 间隔超 5min TTL',
      ],
      ['有命中', fmt(hasHit), `${Math.round((hasHit / Math.max(1, total)) * 100)}%`, '缓存工作，属命中率优化'],
    ],
  );

  // 3. 零缓存请求是否够缓存门槛（input>=1024 token 的"本可缓存"占比）
  const qEligible = `SELECT count(*) as cnt, sum(CASE WHEN input_tokens>=${CACHE_MIN_TOKENS} THEN 1 ELSE 0 END) as eligible, sum(input_tokens) as it, sum(cached_input_tokens) as cit, sum(cache_write_tokens) as cwt FROM usage_logs WHERE ${claudeWhere} AND cached_input_tokens=0 AND cache_write_tokens=0;`;
  const [elig] = await execD1(qEligible, remote);
  const eligCnt = num(elig?.cnt);
  const eligible = num(elig?.eligible);
  console.log(`\n=== 3. 零缓存请求中 input>=${CACHE_MIN_TOKENS} token（达到缓存门槛，本可受益）===`);
  console.log(
    `零缓存请求 ${fmt(eligCnt)} 条，其中达门槛 ${fmt(eligible)} 条 (${Math.round((eligible / Math.max(1, eligCnt)) * 100)}%)；消耗普通输入 ${fmt(num(elig?.it))} tok（按缓存读计可省 ~90%）`,
  );
  console.log(`注：haiku 系列（claude-haiku-*）门槛为 2048，此处统一按 ${CACHE_MIN_TOKENS} 统计`);

  // 4. 请求间隔分析（TTL 过期风险）：按 model 分区取前一条的时间差，分桶量化 5min/1h TTL 各能覆盖多少
  const qGaps = `WITH ordered AS (SELECT created_at, model_id, LAG(created_at) OVER (PARTITION BY model_id ORDER BY created_at) as prev_at FROM usage_logs WHERE ${claudeWhere}) SELECT count(*) as withPrev, sum(CASE WHEN created_at-prev_at<=${TTL_SECONDS} THEN 1 ELSE 0 END) as withinTtl, sum(CASE WHEN created_at-prev_at>${TTL_SECONDS} AND created_at-prev_at<=3600 THEN 1 ELSE 0 END) as gapTtlTo1h, sum(CASE WHEN created_at-prev_at>3600 THEN 1 ELSE 0 END) as over1h, round(avg(created_at-prev_at), 1) as avgGap, min(created_at-prev_at) as minGap, max(created_at-prev_at) as maxGap FROM ordered WHERE prev_at IS NOT NULL;`;
  const [gaps] = await execD1(qGaps, remote);
  const withPrev = num(gaps?.withPrev);
  const overTtl = num(gaps?.overTtl);
  console.log('\n=== 4. 同模型相邻请求间隔（>300s 缓存必过期，cwt>0 且 cit=0 的主因）===');
  console.log(
    `有前驱的请求 ${fmt(withPrev)} 条，间隔>${TTL_SECONDS}s 的 ${fmt(overTtl)} 条 (${Math.round((overTtl / Math.max(1, withPrev)) * 100)}%)，avg=${num(gaps?.avgGap)}s min=${fmt(num(gaps?.minGap))}s max=${fmt(num(gaps?.maxGap))}s`,
  );
  console.log(
    `分桶：≤${TTL_SECONDS}s ${fmt(num(gaps?.withinTtl))} 条 ｜ ${TTL_SECONDS}s~1h ${fmt(num(gaps?.gapTtlTo1h))} 条（换 1h TTL 可命中，写价 2x）｜ >1h ${fmt(num(gaps?.over1h))} 条（任何 TTL 都救不回）`,
  );

  // 5. 判定结论
  console.log('\n=== 5. 判定结论 ===');
  if (total === 0) {
    console.log('窗口内无 claude 流量，请调整 --from/--to 或确认用户/模型名');
  } else if (zeroCache / total > 0.9 && writeOnly === 0) {
    console.log('→ 形态一：缓存断点从未生效（cwt/cit 恒 0）。两种可能：');
    console.log('  a) 客户走 /v1/chat/completions（OpenAI 兼容入口）→ 平台结构性限制，引导改走 /v1/messages');
    console.log('  b) 客户走 /v1/messages 但请求里没写 cache_control → 客户代码问题');
    console.log(
      '  区分方法：CF 后台 Workers Logs 搜 "[billing] 入站请求.*provider=anthropic"（compat 入口专属日志），',
    );
    console.log('  或 AI Gateway Logs 看请求命中的端点（/v1/messages vs compat）');
  } else if (zeroCache / total > 0.9 && writeOnly > 0) {
    console.log('→ 形态二：断点有生效但几乎零命中。前缀不稳定（动态时间戳/随机内容）或请求间隔超 5min TTL');
    console.log('  （见第 4 节占比）。属于客户使用方式问题，对照 docs/claude-prompt-cache-guide.md 自查清单回复客户');
  } else {
    console.log('→ 形态三：已有命中（占比见第 2 节），属命中率优化：增大稳定前缀、断点位置前移、控制请求间隔');
  }

  // 6. 可复制的辅助命令
  console.log('\n=== 6. 后续取证命令 ===');
  console.log('# CF 后台 → Workers Logs（observability 已开启）搜索：');
  console.log(`  [billing] 入站请求  +  provider=anthropic  ${isAll ? '' : `+ user=${userId}`}`);
  console.log('# CF 后台 → AI Gateway (api-router) → Logs：看 Claude 请求的端点与 Anthropic 返回的 cache tokens');
  console.log(
    '# CF 后台 → AI Gateway → anthropic provider → Stored Keys：确认只有 1 个 key（多 key 轮换会打散 org 级缓存）',
  );
  console.log('# 实时观察（部署 /v1/messages 入站日志后）：');
  console.log('  wrangler tail mui-api --format pretty | grep -E "入站请求|cache"');
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
