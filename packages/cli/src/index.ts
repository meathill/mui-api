import path from 'node:path';
import { INTEGRATION_VERSION } from '../../shared-db/src/integration.ts';
import { login } from './auth.ts';
import { connect, installSkill } from './connect.ts';
import { doctor, installCredential, runProject, upgrade } from './commands.ts';

const args = process.argv.slice(2);
function option(name: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
const root = path.resolve(option('--cwd') ?? process.cwd());
try {
  let result: unknown;
  switch (args[0]) {
    case 'login': {
      await login(option('--api-base'), option('--website'));
      result = { authenticated: true };
      break;
    }
    case 'connect': {
      const mode = option('--billing-mode');
      if (mode !== undefined && mode !== 'wallet' && mode !== 'meter_only')
        throw new Error('billing-mode 必须是 wallet 或 meter_only');
      result = await connect(root, mode);
      break;
    }
    case 'doctor':
      result = await doctor(root, args.includes('--probe'));
      break;
    case 'upgrade':
      result = await upgrade(root);
      break;
    case 'run': {
      if (!args.includes('--')) throw new Error('用法：muirouter run -- <项目启动命令>');
      process.exitCode = await runProject(root, args.slice(args.indexOf('--') + 1));
      break;
    }
    case 'credentials': {
      const config = option('--config');
      if (args[1] !== 'install' || !config) throw new Error('用法：credentials install --config <wrangler 配置>');
      result = await installCredential(root, config);
      break;
    }
    case 'skill':
      result = { skillPath: await installSkill() };
      break;
    case '--version':
      result = { version: INTEGRATION_VERSION };
      break;
    default:
      result = {
        version: INTEGRATION_VERSION,
        commands: [
          'login',
          'connect',
          'doctor --probe',
          'upgrade',
          'run -- <command>',
          'credentials install --config <path>',
          'skill install',
        ],
        json: '全部命令输出结构化 JSON，支持 --json',
      };
  }
  if (result !== undefined) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ error: error instanceof Error ? error.message : '操作失败' })}\n`);
  process.exitCode = 1;
}
