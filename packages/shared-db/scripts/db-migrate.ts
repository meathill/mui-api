import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { sharedCloudflareStatePath } from '../dev-config.ts';

const mode = process.argv[2];

if (mode !== 'local' && mode !== 'prod') {
  console.error('用法：node ./scripts/db-migrate.ts <local|prod>');
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const wranglerBin = process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler';
const args = ['d1', 'migrations', 'apply', 'DB'];

if (mode === 'local') {
  args.push('--local', '--persist-to', sharedCloudflareStatePath);
} else {
  args.push('--remote');
}

const child = spawn(wranglerBin, args, {
  cwd: packageRoot,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
