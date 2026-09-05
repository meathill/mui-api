import {
  audioModelRates,
  configurationChanges,
  controlDocuments,
  integrationProjects,
  modelConnections,
  models,
  providerConnections,
} from '@muirouter/shared-db/business';
import { hashApiKey } from '@muirouter/shared-db/crypto';
import { DEFAULT_CHAT_MODEL } from '@muirouter/shared-db/integration';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../db';
import type { CloudflareBindings } from '../types';
import { ControlError, requireScope, type ControlActor } from './control-auth';
import { getProject } from './control-projects';
import { changeSchema, configurationTarget, type ConfigurationChange } from './control-schema';
import { createProxyServices } from './service-factory';

export async function getConfiguration(db: Database, actor: ControlActor, target: string) {
  requireScope(actor, 'projects:read');
  if (target.startsWith('project/')) await getProject(db, actor, target.slice(8));
  else if (target !== 'defaults') requireScope(actor, 'configuration:write', true);
  const row = await db.select().from(controlDocuments).where(eq(controlDocuments.target, target)).get();
  return row
    ? { target, version: row.version, value: JSON.parse(row.dataJson) as unknown }
    : { target, version: 0, value: null };
}

export async function validateConfiguration(
  env: CloudflareBindings,
  db: Database,
  actor: ControlActor,
  change: ConfigurationChange,
) {
  if (change.kind === 'project') {
    requireScope(actor, 'projects:write');
    const project = await getProject(db, actor, change.id);
    if (project.billingMode !== change.value.billingMode && !actor.isAdmin)
      throw new ControlError('forbidden', '仅管理员可修改计费模式', 403);
  } else requireScope(actor, 'configuration:write', true);
  if (change.kind === 'defaults' || change.kind === 'project') {
    const defaults = change.kind === 'defaults' ? change.value : change.value.defaults;
    const catalog = createProxyServices(env, db).modelCatalog;
    for (const modelId of Object.values(defaults))
      if (!(await catalog.getById(modelId))) throw new ControlError('unknown_model', `模型不存在：${modelId}`);
  }
  if (change.kind === 'connection') {
    validateConnectionAddress(change.value.baseUrl);
    const ref = change.value.credentialRef;
    if (
      ref &&
      !/^(OPENAI_API_KEY|MIMO_API_KEY|MOONSHOT_API_KEY|DEEPSEEK_API_KEY|OPENCODE_GO_API_KEY|CF_AIG_TOKEN|PROVIDER_[A-Z0-9_]+)$/.test(
        ref,
      )
    )
      throw new ControlError('invalid_credential_ref', '凭证引用必须是 provider 专用 secret');
    if (change.value.enabled && change.value.protocol !== 'workers-ai' && (!ref || !Reflect.get(env, ref)))
      throw new ControlError('credential_missing', '请先安装连接所需凭证，再启用连接');
  }
  if (change.kind === 'route') {
    const connection = await db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.id, change.value.connectionId))
      .get();
    if (!connection) throw new ControlError('unknown_connection', '连接不存在');
    if (!(await createProxyServices(env, db).modelCatalog.getById(change.value.modelId)))
      throw new ControlError('unknown_model', '模型不存在');
  }
}

export function validateConnectionAddress(baseUrl: string | null) {
  if (!baseUrl) return;
  const url = new URL(baseUrl);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.hostname.includes('.') ||
    /^[\d.]+$/.test(url.hostname) ||
    /[\[\]:]/.test(url.hostname) ||
    /(?:^|\.)(localhost|local|internal|test)$/.test(url.hostname)
  ) {
    throw new ControlError('invalid_endpoint', '连接地址必须是无认证信息的公共 HTTPS 域名');
  }
}

export async function applyConfiguration(env: CloudflareBindings, db: Database, actor: ControlActor, raw: unknown) {
  const input = changeSchema.parse(raw);
  await validateConfiguration(env, db, actor, input.change);
  const target = configurationTarget(input.change);
  const requestHash = await hashApiKey(
    JSON.stringify({ change: input.change, expectedVersion: input.expectedVersion }),
  );
  const previous = await db
    .select()
    .from(configurationChanges)
    .where(
      and(
        eq(configurationChanges.actorId, actor.userId),
        eq(configurationChanges.idempotencyKey, input.idempotencyKey),
      ),
    )
    .get();
  if (previous) {
    if (previous.requestHash !== requestHash)
      throw new ControlError('idempotency_conflict', '同一幂等标识不能用于不同变更', 409);
    await synchronizeCache(env, db, input.change);
    return { changeId: previous.id, target, version: previous.revision, replayed: true };
  }
  const current = await getConfiguration(db, actor, target);
  if (current.version !== input.expectedVersion)
    throw new ControlError('version_conflict', `配置已更新，当前版本 ${current.version}`, 409);
  if (input.dryRun)
    return { target, version: current.version, valid: true, before: current.value, after: input.change };
  const version = current.version + 1;
  const changeId = crypto.randomUUID();
  const afterJson = JSON.stringify(input.change);
  const domainWrite = buildDomainWrite(db, input.change, version);
  try {
    // D1 batch 原子提交。target/revision 唯一约束保证两个并发旧版本写入仅一个成功。
    await db.batch([
      db.insert(configurationChanges).values({
        id: changeId,
        actorId: actor.userId,
        idempotencyKey: input.idempotencyKey,
        requestHash,
        target,
        revision: version,
        beforeJson: current.value ? JSON.stringify(current.value) : null,
        afterJson,
        createdAt: Date.now(),
      }),
      db
        .insert(controlDocuments)
        .values({ target, version, dataJson: afterJson })
        .onConflictDoUpdate({ target: controlDocuments.target, set: { version, dataJson: afterJson } }),
      ...(domainWrite ? [domainWrite] : []),
    ]);
  } catch (error) {
    if (/UNIQUE|constraint/i.test(String(error)))
      throw new ControlError('version_conflict', '并发配置变更，请重新读取版本后重试', 409);
    throw error;
  }
  await synchronizeCache(env, db, input.change);
  return { changeId, target, version, replayed: false };
}

function buildDomainWrite(db: Database, change: ConfigurationChange, version: number) {
  switch (change.kind) {
    case 'project':
      return db
        .update(integrationProjects)
        .set({
          name: change.value.name,
          billingMode: change.value.billingMode,
          defaultsJson: JSON.stringify(change.value.defaults),
          isActive: change.value.isActive,
          version,
        })
        .where(eq(integrationProjects.id, change.id));
    case 'connection':
      return db
        .insert(providerConnections)
        .values({ ...change.value, version })
        .onConflictDoUpdate({ target: providerConnections.id, set: { ...change.value, version } });
    case 'route':
      return db
        .insert(modelConnections)
        .values({ ...change.value, version })
        .onConflictDoUpdate({ target: modelConnections.modelId, set: { ...change.value, version } });
    case 'model':
      return db.insert(models).values(change.value).onConflictDoUpdate({ target: models.id, set: change.value });
    case 'defaults':
      return undefined;
    case 'audio_rate':
      return db
        .insert(audioModelRates)
        .values(change.value)
        .onConflictDoUpdate({ target: audioModelRates.modelId, set: change.value });
  }
}

async function synchronizeCache(env: CloudflareBindings, db: Database, change: ConfigurationChange) {
  if (change.kind === 'model') await createProxyServices(env, db).modelCatalog.refresh();
}

export async function getGlobalModelDefaults(db: Database) {
  const document = await db.select().from(controlDocuments).where(eq(controlDocuments.target, 'defaults')).get();
  if (!document)
    return {
      chat: DEFAULT_CHAT_MODEL,
      tts: 'mimo-v2.5-tts',
      stt: 'whisper-large-v3-turbo',
      image: 'gpt-image-2',
      video: 'grok-imagine-video',
    };
  const parsed = changeSchema.shape.change.parse(JSON.parse(document.dataJson));
  return parsed.kind === 'defaults' ? parsed.value : { chat: DEFAULT_CHAT_MODEL };
}

export async function rollbackConfiguration(
  env: CloudflareBindings,
  db: Database,
  actor: ControlActor,
  input: { changeId: string; expectedVersion: number; idempotencyKey: string },
) {
  const previous = await db
    .select()
    .from(configurationChanges)
    .where(eq(configurationChanges.id, input.changeId))
    .get();
  if (!previous) throw new ControlError('not_found', '配置版本不存在', 404);
  const change = changeSchema.shape.change.parse(JSON.parse(previous.afterJson));
  return applyConfiguration(env, db, actor, {
    change,
    expectedVersion: input.expectedVersion,
    idempotencyKey: input.idempotencyKey,
  });
}
