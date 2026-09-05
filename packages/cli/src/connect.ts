import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { createHash, randomBytes } from 'node:crypto';
import { INTEGRATION_VERSION, type IntegrationManifest } from '../../shared-db/src/integration.ts';
import { INTEGRATION_SKILL } from '../../shared-db/src/integration-guide.ts';
import { control, credentials } from './auth.ts';
import { projectKeyPath, readJson, readManifest, saveJson, type ProjectCredential } from './storage.ts';

const runFile = promisify(execFile);
export function normalizeRepository(remote: string): string {
  const normalized = remote.trim().replace(/^git@([^:]+):/, 'https://$1/');
  const url = new URL(normalized);
  return `${url.hostname}${url.pathname.replace(/\.git$/, '').replace(/\/+$/, '')}`;
}
export async function installSkill() {
  const root = process.env.CODEX_HOME || path.join(homedir(), '.codex');
  const directory = path.join(root, 'skills', 'muirouter-integration');
  const destination = path.join(directory, 'SKILL.md');
  try {
    const existing = await readFile(destination, 'utf8');
    if (existing === INTEGRATION_SKILL) return directory;
    if (!existing.includes('managed_by: muirouter-cli'))
      throw new Error('同名 skill 不是 CLI 管理的版本，请先保留用户修改并解决冲突');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await mkdir(directory, { recursive: true });
  await writeFile(destination, INTEGRATION_SKILL, 'utf8');
  return directory;
}

export async function connect(root: string, requestedBilling?: 'wallet' | 'meter_only') {
  const auth = await credentials();
  const existing = await readManifest(root);
  if (existing && existing.apiBaseUrl !== auth.apiBaseUrl)
    throw new Error('仓库已连接其它 API 地址，请先检查 .muirouter.json');
  let projectId = existing?.projectId;
  let name = existing?.name ?? path.basename(root);
  if (!projectId) {
    const info = await control<{ canManageInternal: boolean }>('get_service_info');
    let repository = `local:${createHash('sha256').update(path.resolve(root)).digest('hex')}`;
    try {
      repository = normalizeRepository((await runFile('git', ['remote', 'get-url', 'origin'], { cwd: root })).stdout);
    } catch {}
    const result = await control<{ project: { id: string; name: string } }>('ensure_project', {
      repository,
      name,
      billingMode: requestedBilling ?? (info.canManageInternal ? 'meter_only' : 'wallet'),
    });
    projectId = result.project.id;
    name = result.project.name;
  }
  const manifest: IntegrationManifest = existing ?? {
    projectId,
    name,
    version: INTEGRATION_VERSION,
    apiBaseUrl: auth.apiBaseUrl,
    models: { chat: 'default' },
    capabilities: ['chat'],
  };
  await control('get_project', { projectId });
  await saveJson(path.join(root, '.muirouter.json'), manifest);
  let saved = await readJson<ProjectCredential>(projectKeyPath(projectId));
  if (saved && saved.apiBaseUrl !== auth.apiBaseUrl) throw new Error('已有凭证属于其它 API，不能复用');
  if (!saved) {
    // 先原子落盘再提交哈希；网络响应丢失时重复安装同一 key，不产生孤立凭证。
    const rawKey = `sk-gw-${randomBytes(32).toString('base64url')}`;
    saved = {
      rawKey,
      keyId: createHash('sha256').update(rawKey).digest('hex'),
      keyPrefix: `${rawKey.slice(0, 12)}...`,
      apiBaseUrl: auth.apiBaseUrl,
    };
    await saveJson(projectKeyPath(projectId), saved, true);
  }
  await control('install_project_key', { projectId, keyId: saved.keyId, keyPrefix: saved.keyPrefix });
  const skillPath = await installSkill();
  return {
    projectId,
    name,
    configured: true,
    skillPath,
    version: manifest.version,
    sourceAdaptation: '按 skill 检查并适配本项目服务端 AI 调用，再运行 doctor --probe 和业务回归',
    environment: { MUIROUTER_BASE_URL: `${auth.apiBaseUrl}/v1`, MUIROUTER_MODEL: manifest.models.chat ?? 'default' },
  };
}
