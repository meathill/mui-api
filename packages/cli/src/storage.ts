import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import type { IntegrationManifest } from '../../shared-db/src/integration.ts';

export interface LoginCredentials {
  apiBaseUrl: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
export interface ProjectCredential {
  apiBaseUrl: string;
  rawKey: string;
  keyId: string;
  keyPrefix: string;
}

export function configDirectory() {
  return process.env.MUIROUTER_CONFIG_DIR || path.join(homedir(), '.config', 'muirouter');
}
export async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
export async function saveJson(file: string, value: unknown, privateFile = false) {
  await mkdir(path.dirname(file), { recursive: true, mode: privateFile ? 0o700 : 0o755 });
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: privateFile ? 0o600 : 0o644, flag: 'wx' });
  await rename(temporary, file);
}
export function loginPath() {
  return path.join(configDirectory(), 'login.json');
}
export function projectKeyPath(projectId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error('projectId 无效');
  return path.join(configDirectory(), 'projects', `${projectId}.json`);
}
export async function readManifest(root: string): Promise<IntegrationManifest | null> {
  const value = await readJson<IntegrationManifest>(path.join(root, '.muirouter.json'));
  if (
    value &&
    (typeof value.projectId !== 'string' ||
      typeof value.apiBaseUrl !== 'string' ||
      !value.models ||
      typeof value.models !== 'object')
  )
    throw new Error('.muirouter.json 无效');
  return value;
}
export async function runtimeCredential(manifest: IntegrationManifest) {
  const credential = await readJson<ProjectCredential>(projectKeyPath(manifest.projectId));
  if (!credential) throw new Error('本地缺少项目凭证，请运行 muirouter connect');
  if (credential.apiBaseUrl !== manifest.apiBaseUrl) throw new Error('项目 API 地址与已授权凭证不一致');
  return credential;
}
