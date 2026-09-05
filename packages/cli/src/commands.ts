import { spawn } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import path from 'node:path';
import { INTEGRATION_VERSION } from '../../shared-db/src/integration.ts';
import { control } from './auth.ts';
import { installSkill } from './connect.ts';
import { readManifest, runtimeCredential, saveJson } from './storage.ts';

export async function doctor(root: string, probe: boolean) {
  const manifest = await readManifest(root);
  if (!manifest)
    return { local: false, configured: false, probe: 'not_run', deployment: 'not_verified', next: 'muirouter connect' };
  const key = await runtimeCredential(manifest);
  const validation = await control<{ configured: boolean; billingMode: string }>('validate_project', {
    projectId: manifest.projectId,
  });
  let probeResult: Record<string, unknown> = { status: 'not_run' };
  if (probe) {
    const response = await fetch(`${manifest.apiBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key.rawKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: manifest.models.chat ?? 'default',
        messages: [{ role: 'user', content: 'Reply with OK.' }],
        max_completion_tokens: 64,
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000),
      redirect: 'error',
    });
    const value: unknown = await response.json().catch(() => null);
    const data = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    probeResult = {
      status: response.ok ? 'passed' : 'failed',
      httpStatus: response.status,
      model: data.model ?? null,
      usage: data.usage ?? null,
    };
  }
  return {
    local: true,
    projectId: manifest.projectId,
    keyPrefix: key.keyPrefix,
    configured: validation.configured,
    billingMode: validation.billingMode,
    probe: probeResult,
    deployment: 'not_verified',
    businessAcceptance: 'not_verified',
  };
}

export async function upgrade(root: string) {
  const manifest = await readManifest(root);
  if (!manifest) throw new Error('尚未接入，请运行 muirouter connect');
  const plan = await control<{ currentVersion: string; needsUpgrade: boolean }>('get_upgrade_plan', {
    projectId: manifest.projectId,
    installedVersion: manifest.version,
  });
  if (plan.currentVersion !== INTEGRATION_VERSION)
    throw new Error('CLI 版本与服务不一致，请用 pnpm dlx @muirouter/cli@latest upgrade');
  if (manifest.version.split('.')[0] !== INTEGRATION_VERSION.split('.')[0])
    throw new Error('需要按新版 skill 完成主版本代码迁移后再更新接入版本');
  const skillPath = await installSkill();
  await saveJson(path.join(root, '.muirouter.json'), { ...manifest, version: INTEGRATION_VERSION });
  return { ...plan, skillPath, next: 'muirouter doctor --probe；随后执行项目业务回归' };
}

export async function runProject(root: string, command: string[]) {
  const manifest = await readManifest(root);
  if (!manifest || !command[0]) throw new Error('用法：muirouter run -- <项目启动命令>（项目须已接入）');
  const credential = await runtimeCredential(manifest);
  return spawnCommand(command[0], command.slice(1), root, {
    ...process.env,
    MUIROUTER_API_KEY: credential.rawKey,
    MUIROUTER_BASE_URL: `${manifest.apiBaseUrl}/v1`,
    MUIROUTER_MODEL: process.env.MUIROUTER_MODEL || manifest.models.chat || 'default',
    MUIROUTER_TTS_MODEL: process.env.MUIROUTER_TTS_MODEL || manifest.models.tts || 'default',
    MUIROUTER_STT_MODEL: process.env.MUIROUTER_STT_MODEL || manifest.models.stt || 'default',
  });
}

export async function installCredential(root: string, config: string) {
  const manifest = await readManifest(root);
  if (!manifest) throw new Error('请先运行 connect');
  const credential = await runtimeCredential(manifest);
  const resolved = path.resolve(root, config);
  if (!/^wrangler\.(jsonc?|toml)$/.test(path.basename(resolved))) throw new Error('请指定已核实的 wrangler 配置');
  await access(resolved, constants.R_OK);
  const code = await spawnCommand(
    'pnpm',
    ['exec', 'wrangler', 'secret', 'put', 'MUIROUTER_API_KEY', '--config', resolved],
    root,
    process.env,
    `${credential.rawKey}\n`,
  );
  if (code !== 0) throw new Error('部署凭证安装失败');
  return { installed: true, projectId: manifest.projectId, config: resolved, keyPrefix: credential.keyPrefix };
}

function spawnCommand(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  input?: string,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
    if (input !== undefined) child.stdin?.end(input);
  });
}
