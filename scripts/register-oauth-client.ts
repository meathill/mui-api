import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 注册一个 OAuth 客户端到 D1 oauth_clients 表，生成一次性 client_secret。
 *
 * 用法：
 *   pnpm exec node scripts/register-oauth-client.ts \
 *     --client-id muicv \
 *     --name "muicv simple resume" \
 *     --redirect-uri https://muicv.com/api/muirouter/oauth/callback \
 *     --redirect-uri http://localhost:3070/api/muirouter/oauth/callback \
 *     --scopes balance,llm \
 *     [--owner-email me@example.com] \
 *     [--remote]   # 默认写本地 D1，加 --remote 走生产
 *
 * 脚本生成的 client_secret 仅本次显示，复制后给客户端配在 wrangler secret 里。
 * 重复跑同一个 client_id 会报 UNIQUE 冲突——需要先去后台 (admin) 删/改。
 */

interface CliOptions {
  clientId: string;
  name: string;
  redirectUris: string[];
  scopes: string;
  ownerEmail: string | null;
  remote: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: Partial<CliOptions> & { redirectUris: string[] } = { redirectUris: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`参数 ${a} 缺值`);
      return v;
    };
    switch (a) {
      case '--client-id':
        opts.clientId = next();
        break;
      case '--name':
        opts.name = next();
        break;
      case '--redirect-uri':
        opts.redirectUris.push(next());
        break;
      case '--scopes':
        opts.scopes = next();
        break;
      case '--owner-email':
        opts.ownerEmail = next();
        break;
      case '--remote':
        opts.remote = true;
        break;
      default:
        throw new Error(`未知参数：${a}`);
    }
  }
  if (!opts.clientId) throw new Error('--client-id 必填');
  if (!opts.name) throw new Error('--name 必填');
  if (opts.redirectUris.length === 0) throw new Error('至少传一个 --redirect-uri');
  return {
    clientId: opts.clientId,
    name: opts.name,
    redirectUris: opts.redirectUris,
    scopes: opts.scopes ?? 'balance,llm',
    ownerEmail: opts.ownerEmail ?? null,
    remote: opts.remote ?? false,
  };
}

function generateSecret(): string {
  const buf = randomBytes(32);
  return `cs_${buf.toString('base64url')}`;
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function escapeSqlText(s: string): string {
  return s.replace(/'/g, "''");
}

async function runWrangler(args: string[], cwd: string): Promise<void> {
  const wranglerBin = process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler';
  return new Promise((resolve, reject) => {
    const child = spawn(wranglerBin, args, { cwd, stdio: 'inherit' });
    child.on('error', (err) => reject(err));
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`wrangler 退出码 ${code}`))));
  });
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const secret = generateSecret();
  const secretHash = sha256Hex(secret);
  const allowedRedirectsJson = JSON.stringify(opts.redirectUris);
  const ownerEmailLiteral = opts.ownerEmail ? `'${escapeSqlText(opts.ownerEmail)}'` : 'NULL';

  const sql = `INSERT INTO oauth_clients (
  client_id, client_secret_hash, name, owner_email, allowed_redirect_uris, allowed_scopes, is_active
) VALUES (
  '${escapeSqlText(opts.clientId)}',
  '${secretHash}',
  '${escapeSqlText(opts.name)}',
  ${ownerEmailLiteral},
  '${escapeSqlText(allowedRedirectsJson)}',
  '${escapeSqlText(opts.scopes)}',
  1
);`;

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const sharedDbDir = path.resolve(scriptDir, '..', 'packages', 'shared-db');
  const wranglerArgs = ['d1', 'execute', 'DB', '--command', sql];
  if (opts.remote) wranglerArgs.push('--remote');
  else wranglerArgs.push('--local');

  console.log('\n=== 即将执行的 SQL ===');
  console.log(sql);
  console.log(`\n目标：${opts.remote ? 'remote (生产 D1)' : 'local (开发 D1)'}\n`);

  await runWrangler(wranglerArgs, sharedDbDir);

  console.log('\n=== 注册成功，记下你的 client_secret（只显示一次）===');
  console.log(`client_id     = ${opts.clientId}`);
  console.log(`client_secret = ${secret}`);
  console.log('\n把这两个值发给客户端配置；secret 不会再有第二次机会显示。');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
