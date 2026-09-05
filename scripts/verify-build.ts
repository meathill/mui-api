import { cp, mkdir, mkdtemp, readdir, symlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Vite/Next/Cloudflare 会自动加载环境文件；验收构建只使用去除秘密文件的临时源码副本。
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = await mkdtemp(path.join(tmpdir(), 'muirouter-build-'));
const target = process.argv[2];
if (target !== 'app' && target !== 'dashboard') throw new Error('用法：node scripts/verify-build.ts app|dashboard');
const excluded = new Set([
  'node_modules',
  '.next',
  '.open-next',
  '.wrangler',
  'dist',
  'coverage',
  'test-results',
  'playwright-report',
  '.git',
]);
await cp(path.join(repository, 'packages'), path.join(directory, 'packages'), {
  recursive: true,
  filter(source) {
    const name = path.basename(source);
    return !excluded.has(name) && !/^\.env(?:\.|$)|^\.dev\.vars(?:\.|$)|\.(?:pem|key|log)$/.test(name);
  },
});
await cp(path.join(repository, 'package.json'), path.join(directory, 'package.json'));
await symlink(path.join(repository, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
for (const entry of await readdir(path.join(directory, 'packages'), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  await mkdir(path.join(directory, 'packages', entry.name), { recursive: true });
  await symlink(
    path.join(repository, 'packages', entry.name, 'node_modules'),
    path.join(directory, 'packages', entry.name, 'node_modules'),
    'dir',
  );
}
process.stdout.write(`无秘密文件的构建副本：${directory}\n`);
const command = target === 'app' ? ['vite', 'build'] : ['next', 'build', '--webpack'];
const executable = path.join(repository, 'packages', target, 'node_modules', '.bin', command[0]!);
const child = spawn(executable, command.slice(1), {
  cwd: path.join(directory, 'packages', target),
  stdio: 'inherit',
  env: {
    ...process.env,
    WRANGLER_LOG_PATH: path.join(directory, 'wrangler.log'),
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
    NEXT_TELEMETRY_DISABLED: '1',
  },
});
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
