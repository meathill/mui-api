import {
  configurationChanges,
  integrationProjects,
  providerConnections,
  usageLogs,
} from '@muirouter/shared-db/business';
import {
  API_BASE_URL,
  INTEGRATION_VERSION,
  MODEL_CAPABILITIES,
  parseModelDefaults,
  type ControlScope,
} from '@muirouter/shared-db/integration';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../db';
import type { CloudflareBindings } from '../types';
import { requireScope, type ControlActor } from './control-auth';
import {
  applyConfiguration,
  getConfiguration,
  getGlobalModelDefaults,
  rollbackConfiguration,
} from './control-configuration';
import { ensureProject, getProject, listProjectKeys, listProjects, revokeProjectKey } from './control-projects';
import { changeSchema, projectSchema } from './control-schema';
import { createProxyServices } from './service-factory';

export interface ControlContext {
  env: CloudflareBindings;
  db: Database;
  actor: ControlActor;
}
export interface ControlTool {
  name: string;
  description: string;
  schema: z.ZodType;
  scope: ControlScope;
  admin?: boolean;
  readOnly: boolean;
  handler: (context: ControlContext, input: unknown) => Promise<Record<string, unknown>>;
}

function defineTool<T extends z.ZodType>(
  name: string,
  description: string,
  schema: T,
  scope: ControlScope,
  readOnly: boolean,
  handler: (context: ControlContext, input: z.output<T>) => Promise<Record<string, unknown>>,
  admin = false,
): ControlTool {
  return {
    name,
    description,
    schema,
    scope,
    readOnly,
    admin,
    handler: (context, input) => handler(context, schema.parse(input)),
  };
}

const empty = z.object({}).strict();
const projectId = z.object({ projectId: z.string().min(1) }).strict();
export const controlTools: ControlTool[] = [
  defineTool(
    'get_service_info',
    '查询服务版本、接入文档和模型能力。',
    empty,
    'projects:read',
    true,
    async ({ actor }) => ({
      canManageInternal: actor.isAdmin,
      apiVersion: INTEGRATION_VERSION,
      cliVersion: INTEGRATION_VERSION,
      skillVersion: INTEGRATION_VERSION,
      apiBaseUrl: API_BASE_URL,
      skillUrl: 'https://muirouter.com/skill.md',
      capabilities: MODEL_CAPABILITIES,
      configurationPrecedence: ['explicit_model', 'project_defaults', 'global_defaults'],
    }),
  ),
  defineTool('list_projects', '查询当前账号可管理的项目。', empty, 'projects:read', true, async ({ db, actor }) => ({
    projects: await listProjects(db, actor),
  })),
  defineTool(
    'get_project',
    '查询项目模型、计费模式和接入版本。',
    projectId,
    'projects:read',
    true,
    async ({ db, actor }, input) => ({ project: await getProject(db, actor, input.projectId) }),
  ),
  defineTool(
    'ensure_project',
    '按仓库身份登记或复用项目。重复调用不会覆盖配置；meter_only 仅管理员可创建。',
    projectSchema,
    'projects:write',
    false,
    async ({ db, actor }, input) => ({ project: await ensureProject(db, actor, input) }),
  ),
  defineTool(
    'get_defaults',
    '查询全局默认及项目覆盖后的模型；运行 key 只能读取自己的项目。',
    projectId.partial(),
    'projects:read',
    true,
    async ({ db, actor }, input) => {
      const global = await getGlobalModelDefaults(db);
      const id = actor.projectId ?? input.projectId;
      const project = id ? (await getProject(db, actor, id)).defaults : {};
      return { global, project, effective: { ...global, ...project } };
    },
  ),
  defineTool(
    'get_configuration',
    '读取配置版本，修改前先取得 expectedVersion。target 为 defaults/project/<id>/model/<id>/connection/<id>/route/<id>。',
    z.object({ target: z.string().min(1) }).strict(),
    'projects:read',
    true,
    async ({ db, actor }, input) => getConfiguration(db, actor, input.target),
  ),
  defineTool(
    'apply_configuration',
    '验证或应用配置。dryRun 只预览；实际写入需当前 expectedVersion 与幂等标识。权限按配置类型校验。',
    changeSchema,
    'projects:write',
    false,
    async ({ env, db, actor }, input) => applyConfiguration(env, db, actor, input),
  ),
  defineTool(
    'rollback_configuration',
    '恢复指定历史配置快照，创建新的配置版本。',
    z
      .object({
        changeId: z.string(),
        expectedVersion: z.number().int().nonnegative(),
        idempotencyKey: z.string().min(8),
      })
      .strict(),
    'projects:write',
    false,
    async ({ env, db, actor }, input) => rollbackConfiguration(env, db, actor, input),
  ),
  defineTool(
    'list_provider_connections',
    '查看 provider 连接及凭证是否已安装，只返回凭证引用。',
    empty,
    'configuration:write',
    true,
    async ({ env, db }) => ({
      connections: (await db.select().from(providerConnections)).map((row) => ({
        ...row,
        credentialConfigured: Boolean(row.credentialRef && Reflect.get(env, row.credentialRef)),
      })),
    }),
    true,
  ),
  defineTool(
    'list_project_keys',
    '查询项目 key 元数据，不返回原文。凭证安装使用 muirouter connect。',
    projectId,
    'projects:read',
    true,
    async ({ env, db, actor }, input) => ({ keys: await listProjectKeys(env, db, actor, input.projectId) }),
  ),
  defineTool(
    'revoke_project_key',
    '撤销指定项目 key。',
    projectId.extend({ keyId: z.string() }),
    'keys:write',
    false,
    async ({ env, db, actor }, input) => revokeProjectKey(env, db, actor, input.projectId, input.keyId),
  ),
  defineTool(
    'get_project_usage',
    '查询项目用量、费用估算、实际扣款及 usage 缺失情况。',
    projectId.extend({ limit: z.number().int().min(1).max(100).default(20) }),
    'projects:read',
    true,
    async ({ db, actor }, input) => {
      await getProject(db, actor, input.projectId);
      return {
        items: await db
          .select()
          .from(usageLogs)
          .where(and(eq(usageLogs.projectId, input.projectId), eq(usageLogs.userId, actor.userId)))
          .orderBy(desc(usageLogs.createdAt))
          .limit(input.limit),
      };
    },
  ),
  defineTool(
    'get_integration_manifest',
    '获取不含秘密的项目接入配置，CLI/skill 共用。',
    projectId,
    'projects:read',
    true,
    async ({ db, actor }, input) => {
      const project = await getProject(db, actor, input.projectId);
      return {
        version: INTEGRATION_VERSION,
        projectId: project.id,
        name: project.name,
        apiBaseUrl: API_BASE_URL,
        models: { chat: 'default' },
        capabilities: ['chat'],
        billingMode: project.billingMode,
        defaults: project.defaults,
      };
    },
  ),
  defineTool(
    'get_upgrade_plan',
    '比较已安装接入版本并返回升级步骤；不会修改项目源码。',
    projectId.extend({ installedVersion: z.string() }),
    'projects:read',
    true,
    async ({ db, actor }, input) => {
      await getProject(db, actor, input.projectId);
      return {
        currentVersion: INTEGRATION_VERSION,
        installedVersion: input.installedVersion,
        needsUpgrade: input.installedVersion !== INTEGRATION_VERSION,
        skillUrl: 'https://muirouter.com/skill.md',
        commands: ['muirouter upgrade', 'muirouter doctor --probe'],
      };
    },
  ),
  defineTool(
    'list_configuration_changes',
    '查询配置修改记录与版本。',
    z.object({ target: z.string(), limit: z.number().int().min(1).max(100).default(20) }),
    'projects:read',
    true,
    async ({ db, actor }, input) => {
      await getConfiguration(db, actor, input.target);
      return {
        changes: await db
          .select()
          .from(configurationChanges)
          .where(eq(configurationChanges.target, input.target))
          .orderBy(desc(configurationChanges.createdAt))
          .limit(input.limit),
      };
    },
  ),
  defineTool(
    'validate_project',
    '检查项目默认模型、启用状态和配置完整性；真实调用由 CLI doctor --probe 验证。',
    projectId,
    'projects:read',
    true,
    async ({ env, db, actor }, input) => {
      const project = await getProject(db, actor, input.projectId);
      const defaults = { ...(await getGlobalModelDefaults(db)), ...parseModelDefaults(project.defaultsJson) };
      const missing: string[] = [];
      for (const id of Object.values(defaults))
        if (!(await createProxyServices(env, db).modelCatalog.getById(id))) missing.push(id);
      return {
        configured: project.isActive && missing.length === 0,
        missingModels: missing,
        defaults,
        billingMode: project.billingMode,
      };
    },
  ),
];

export async function callControlTool(context: ControlContext, name: string, input: unknown) {
  const tool = controlTools.find((item) => item.name === name);
  if (!tool) throw new Error(`未知工具：${name}`);
  requireScope(context.actor, tool.scope, tool.admin);
  return tool.handler(context, input);
}
