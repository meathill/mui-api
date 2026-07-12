import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const sharedDbRoot = path.resolve(packageRoot, '..', 'shared-db');
const fixturePath = path.resolve(packageRoot, 'e2e', 'fixtures', 'models.sql');
const e2eStatePath = path.resolve(packageRoot, '..', '..', '.wrangler', 'e2e-state');
const packageManager = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const wrangler = process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler';
const environment = { ...process.env, MUI_API_STATE_PATH: e2eStatePath };

await run(packageManager, ['run', 'db:migrate:local'], sharedDbRoot, environment);
await run(
  wrangler,
  ['d1', 'execute', 'DB', '--local', '--persist-to', e2eStatePath, '--file', fixturePath],
  packageRoot,
  environment,
);

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} 执行失败，退出码：${code ?? 'unknown'}`));
    });
  });
}
