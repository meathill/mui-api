/**
 * 补录历史手动充值流水（recharge_logs 功能 2026-03-24 上线，此前的手动充值没有流水）。
 *
 * 经 packages/shared-db 目录下的 wrangler d1 execute 执行，鉴权走 wrangler 登录态，
 * 不读取任何 .env。幂等：source_id 取 `backfill-{userId}-{createdAtUnix}`，
 * 借 UNIQUE(source, source_id) 约束防止重复补录（重跑会直接报唯一约束错误）。
 */
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

interface CliOptions {
  email?: string;
  userId?: string;
  amount: number;
  date: string;
  note?: string;
  balanceAfter?: number;
  dryRun: boolean;
  local: boolean;
}

const SHARED_DB_DIR = path.resolve(import.meta.dirname, '../packages/shared-db');
const DATABASE_NAME = 'mui-api';

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();
  let dryRun = false;
  let local = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--local') {
      local = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new Error(`不支持的参数: ${arg}`);
    }
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      throw new Error(`参数缺少值: ${arg}`);
    }
    args.set(arg.slice(2), next);
    index += 1;
  }

  const email = args.get('email');
  const userId = args.get('user-id');
  if (!email && !userId) {
    throw new Error('必须提供 --email 或 --user-id');
  }

  const amount = Number(args.get('amount'));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('--amount 必须是正数（美元）');
  }

  const date = args.get('date');
  if (!date) {
    throw new Error('必须提供 --date（如 "2026-03-16" 或 "2026-03-16 14:30"，按本地时区解析）');
  }

  const balanceAfterRaw = args.get('balance-after');
  const balanceAfter = balanceAfterRaw === undefined ? undefined : Number(balanceAfterRaw);
  if (balanceAfter !== undefined && !Number.isFinite(balanceAfter)) {
    throw new Error('--balance-after 必须是数字');
  }

  return { email, userId, amount, date, note: args.get('note'), balanceAfter, dryRun, local };
}

/** 按本地时区解析日期；只给日期时取当天 12:00，避免时区换算把日期挪到前后一天 */
function parseDateToUnixSeconds(input: string): number {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(input) ? `${input}T12:00:00` : input.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`无法解析日期: ${input}`);
  }
  return Math.floor(parsed.getTime() / 1000);
}

function escapeSqlString(value: string): string {
  return value.replaceAll("'", "''");
}

function executeSql(command: string, local: boolean, dryRun: boolean): unknown {
  if (dryRun) {
    console.log(`[dry-run] wrangler d1 execute ${DATABASE_NAME} ${local ? '--local' : '--remote'} --command:`);
    console.log(command);
    return null;
  }

  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'execute',
      DATABASE_NAME,
      local ? '--local' : '--remote',
      '--json',
      '--command',
      command,
    ],
    { cwd: SHARED_DB_DIR, encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(`wrangler 执行失败:\n${result.stdout}\n${result.stderr}`);
  }

  // wrangler --json 输出是数组，第一个元素包含 results
  const parsed = JSON.parse(result.stdout) as Array<{ results: unknown[] }>;
  return parsed[0]?.results;
}

function resolveUserId(options: CliOptions): string {
  if (options.userId) {
    return options.userId;
  }

  const email = escapeSqlString(options.email!);
  const rows = executeSql(`SELECT id, email FROM user WHERE email = '${email}'`, options.local, false) as Array<{
    id: string;
  }>;

  if (!rows || rows.length === 0) {
    throw new Error(`未找到 email 为 ${options.email} 的注册用户（better-auth user 表）`);
  }
  return rows[0].id;
}

function main(): void {
  try {
    if (process.argv.includes('--help')) {
      printUsage();
      return;
    }

    const options = parseArgs(process.argv.slice(2));
    const userId = options.dryRun && !options.userId ? '<userId>' : resolveUserId(options);
    const createdAt = parseDateToUnixSeconds(options.date);
    const note = escapeSqlString(options.note ?? '历史手动充值补录');
    const balanceAfterSql = options.balanceAfter === undefined ? 'NULL' : String(options.balanceAfter);

    const insertSql = [
      'INSERT INTO recharge_logs (id, user_id, operator_id, amount, balance_after, source, source_id, note, created_at)',
      `VALUES ('${randomUUID()}', '${userId}', NULL, ${options.amount}, ${balanceAfterSql}, 'backfill', 'backfill-${userId}-${createdAt}', '${note}', ${createdAt})`,
    ].join('\n');

    executeSql(insertSql, options.local, options.dryRun);

    if (!options.dryRun) {
      console.log(`已补录: userId=${userId} amount=$${options.amount} created_at=${options.date} (${createdAt})`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.log();
    printUsage();
    process.exitCode = 1;
  }
}

function printUsage(): void {
  console.log('用法:');
  console.log('  node scripts/backfill-recharge-log.ts \\');
  console.log('    --email user@example.com --amount 30 --date "2026-03-16" \\');
  console.log('    [--note "微信转账充值"] [--balance-after 30] [--dry-run] [--local]');
  console.log();
  console.log('说明:');
  console.log('  --email / --user-id  二选一；email 会先查 better-auth user 表解析出 userId');
  console.log('  --date               本地时区，"YYYY-MM-DD" 或 "YYYY-MM-DD HH:mm"；只给日期取当天 12:00');
  console.log('  --balance-after      充值后余额（历史值不可考可省略，记 NULL）');
  console.log('  --dry-run            只打印 SQL 不执行');
  console.log('  --local              写本地 D1（默认 --remote 写生产）');
  console.log();
  console.log('同一 userId + 同一时间重复执行会命中 UNIQUE(source, source_id) 直接报错，不会重复插入。');
}

main();
