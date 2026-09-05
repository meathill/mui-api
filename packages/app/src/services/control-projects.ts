import { integrationProjects } from '@muirouter/shared-db/business';
import { generateApiKey, getKeyPrefix, hashApiKey } from '@muirouter/shared-db/crypto';
import { INTEGRATION_VERSION, parseModelDefaults, type ApiKeyMetadata } from '@muirouter/shared-db/integration';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../db';
import type { CloudflareBindings } from '../types';
import { ControlError, requireScope, type ControlActor } from './control-auth';
import { projectSchema } from './control-schema';

export async function getProject(db: Database, actor: ControlActor, id: string) {
  requireScope(actor, 'projects:read');
  if (actor.projectId && actor.projectId !== id) throw new ControlError('not_found', '项目不存在', 404);
  const row = await db
    .select()
    .from(integrationProjects)
    .where(and(eq(integrationProjects.id, id), eq(integrationProjects.ownerId, actor.userId)))
    .get();
  if (!row) throw new ControlError('not_found', '项目不存在', 404);
  return { ...row, defaults: parseModelDefaults(row.defaultsJson) };
}

export async function listProjects(db: Database, actor: ControlActor) {
  requireScope(actor, 'projects:read');
  return db
    .select()
    .from(integrationProjects)
    .where(
      and(
        eq(integrationProjects.ownerId, actor.userId),
        actor.projectId ? eq(integrationProjects.id, actor.projectId) : undefined,
      ),
    );
}

export async function ensureProject(db: Database, actor: ControlActor, input: unknown) {
  requireScope(actor, 'projects:write');
  const data = projectSchema.parse(input);
  if (data.billingMode === 'meter_only' && !actor.isAdmin)
    throw new ControlError('forbidden', '仅管理员可启用只计量模式', 403);
  // 仓库身份不携带用户令牌；CLI 归一化 git remote 后提交。
  if (/https?:\/\/[^/]*@|[?#]/.test(data.repository))
    throw new ControlError('invalid_repository', '仓库身份不得含认证信息或查询参数');
  await db
    .insert(integrationProjects)
    .values({
      id: crypto.randomUUID(),
      ownerId: actor.userId,
      repository: data.repository,
      name: data.name,
      billingMode: data.billingMode,
      defaultsJson: JSON.stringify(data.defaults),
      integrationVersion: INTEGRATION_VERSION,
    })
    .onConflictDoNothing();
  const row = await db
    .select()
    .from(integrationProjects)
    .where(and(eq(integrationProjects.ownerId, actor.userId), eq(integrationProjects.repository, data.repository)))
    .get();
  if (!row) throw new ControlError('unavailable', '项目登记失败', 503);
  return { ...row, defaults: parseModelDefaults(row.defaultsJson) };
}

export async function issueProjectKey(env: CloudflareBindings, db: Database, actor: ControlActor, projectId: string) {
  requireScope(actor, 'keys:write');
  const project = await getProject(db, actor, projectId);
  if (!project.isActive) throw new ControlError('project_inactive', '项目已停用', 409);
  const rawKey = generateApiKey();
  const hash = await hashApiKey(rawKey);
  const metadata: ApiKeyMetadata = {
    userId: actor.userId,
    projectId,
    label: project.name,
    keyPrefix: getKeyPrefix(rawKey),
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  await env.KV.put(`apikey:${hash}`, actor.userId, { metadata });
  // 仅 CLI 凭证安装 API 返回原文，MCP 工具不调用此函数。
  return { rawKey, keyId: hash, keyPrefix: metadata.keyPrefix };
}

export async function installProjectKey(
  env: CloudflareBindings,
  db: Database,
  actor: ControlActor,
  input: { projectId: string; keyId: string; keyPrefix: string },
) {
  requireScope(actor, 'keys:write');
  const project = await getProject(db, actor, input.projectId);
  if (!project.isActive) throw new ControlError('project_inactive', '项目已停用', 409);
  const existing = await env.KV.getWithMetadata<ApiKeyMetadata>(`apikey:${input.keyId}`, 'text');
  if (existing.value !== null) {
    if (existing.metadata?.projectId !== project.id || existing.metadata.userId !== actor.userId)
      throw new ControlError('key_conflict', '凭证归属不匹配', 409);
    if (!existing.metadata.isActive)
      throw new ControlError('key_revoked', '凭证已撤销，请显式轮换，不会自动重新启用', 409);
    return { keyId: input.keyId, keyPrefix: existing.metadata.keyPrefix, replayed: true };
  }
  const metadata: ApiKeyMetadata = {
    userId: actor.userId,
    projectId: project.id,
    label: project.name,
    keyPrefix: input.keyPrefix,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  await env.KV.put(`apikey:${input.keyId}`, actor.userId, { metadata });
  return { keyId: input.keyId, keyPrefix: input.keyPrefix, replayed: false };
}

export async function listProjectKeys(env: CloudflareBindings, db: Database, actor: ControlActor, projectId: string) {
  await getProject(db, actor, projectId);
  const keys: Array<{ keyId: string; metadata: ApiKeyMetadata }> = [];
  let cursor: string | undefined;
  do {
    const page = await env.KV.list<ApiKeyMetadata>({ prefix: 'apikey:', ...(cursor ? { cursor } : {}) });
    for (const key of page.keys) {
      if (key.metadata?.userId === actor.userId && key.metadata.projectId === projectId)
        keys.push({ keyId: key.name.slice(7), metadata: key.metadata });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

export async function revokeProjectKey(
  env: CloudflareBindings,
  db: Database,
  actor: ControlActor,
  projectId: string,
  keyId: string,
) {
  requireScope(actor, 'keys:write');
  await getProject(db, actor, projectId);
  if (!/^[a-f0-9]{64}$/.test(keyId)) throw new ControlError('invalid_key', 'keyId 无效');
  const key = await env.KV.getWithMetadata<ApiKeyMetadata>(`apikey:${keyId}`, 'text');
  if (key.metadata?.projectId !== projectId || key.metadata.userId !== actor.userId)
    throw new ControlError('not_found', '凭证不存在', 404);
  await env.KV.put(`apikey:${keyId}`, key.value ?? actor.userId, { metadata: { ...key.metadata, isActive: false } });
  return { revoked: true, keyId };
}
