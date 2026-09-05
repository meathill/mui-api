import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createDb } from '../src/db';
import { authenticateControl, type ControlActor } from '../src/services/control-auth';
import { applyConfiguration, getConfiguration, rollbackConfiguration } from '../src/services/control-configuration';
import { ensureProject, getProject, issueProjectKey, listProjectKeys } from '../src/services/control-projects';
import { getBalanceSnapshot, listUsage } from '../src/services/wallet-query-service';
import { callControlTool } from '../src/services/control-tools';
import { seedApiKey } from './helpers';

const db = createDb(env.DB);
const admin: ControlActor = {
  userId: 'control-admin',
  isAdmin: true,
  scopes: ['projects:read', 'projects:write', 'configuration:write', 'keys:write'],
};
const customer: ControlActor = { ...admin, userId: 'control-customer', isAdmin: false };

describe('项目与控制权限', () => {
  it('重复登记复用项目且保留后续配置', async () => {
    const first = await ensureProject(db, admin, {
      repository: 'github.com/test/control',
      name: 'Original',
      billingMode: 'meter_only',
    });
    const second = await ensureProject(db, admin, {
      repository: 'github.com/test/control',
      name: 'Changed',
      billingMode: 'wallet',
    });
    expect(second.id).toBe(first.id);
    expect(second.name).toBe('Original');
    expect(second.billingMode).toBe('meter_only');
    await expect(getProject(db, customer, first.id)).rejects.toMatchObject({ status: 404 });
  });

  it('非管理员不能启用免扣款，即使有项目写权限', async () => {
    await expect(
      ensureProject(db, customer, {
        repository: 'github.com/test/customer',
        name: 'Customer',
        billingMode: 'meter_only',
      }),
    ).rejects.toMatchObject({ status: 403 });
    const project = await ensureProject(db, customer, { repository: 'github.com/test/customer', name: 'Customer' });
    await expect(
      applyConfiguration(env, db, customer, {
        change: {
          kind: 'project',
          id: project.id,
          value: { name: 'Customer', billingMode: 'meter_only', defaults: {}, isActive: true },
        },
        expectedVersion: 0,
        idempotencyKey: 'escalation-test',
        dryRun: false,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('运行 key 无法写配置或取得另一个项目；MCP 不暴露发 key 工具', async () => {
    const project = await ensureProject(db, admin, {
      repository: 'github.com/test/runtime',
      name: 'Runtime',
      billingMode: 'meter_only',
    });
    const key = await issueProjectKey(env, db, admin, project.id);
    const request = new Request('http://localhost/control/ensure_project', {
      headers: { authorization: `Bearer ${key.rawKey}` },
    });
    const actor = await authenticateControl(env, db, request);
    expect(actor.isAdmin).toBe(false);
    await expect(
      callControlTool({ env, db, actor }, 'ensure_project', { repository: 'forbidden', name: 'Forbidden' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(getProject(db, actor, 'another-project')).rejects.toMatchObject({ status: 404 });
    const response = await SELF.fetch('http://localhost/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key.rawKey}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        host: 'localhost',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    const result = (await response.json()) as { result: { tools: Array<{ name: string }> } };
    const names = result.result.tools.map((tool) => tool.name);
    expect(names).not.toContain('apply_configuration');
    expect(names).not.toContain('issue_project_key');
    expect(names).not.toContain('get_balance');
    expect(JSON.stringify(await listProjectKeys(env, db, admin, project.id))).not.toContain(key.rawKey);
  });
});

describe('版本化配置', () => {
  it('幂等、冲突和回滚均保留审计记录', async () => {
    const project = await ensureProject(db, admin, { repository: 'github.com/test/versioned', name: 'Before' });
    const change = {
      change: {
        kind: 'project' as const,
        id: project.id,
        value: { name: 'After', billingMode: 'wallet' as const, defaults: {}, isActive: true },
      },
      expectedVersion: 0,
      idempotencyKey: 'versioned-first',
      dryRun: false,
    };
    const first = await applyConfiguration(env, db, admin, change);
    const replay = await applyConfiguration(env, db, admin, change);
    expect(replay.version).toBe(first.version);
    await expect(
      applyConfiguration(env, db, admin, { ...change, idempotencyKey: 'versioned-conflict' }),
    ).rejects.toMatchObject({ status: 409 });
    await applyConfiguration(env, db, admin, {
      ...change,
      expectedVersion: 1,
      idempotencyKey: 'versioned-second',
      change: { ...change.change, value: { ...change.change.value, name: 'Later' } },
    });
    await rollbackConfiguration(env, db, admin, {
      changeId: String(first.changeId),
      expectedVersion: 2,
      idempotencyKey: 'versioned-rollback',
    });
    expect((await getProject(db, admin, project.id)).name).toBe('After');
    expect((await getConfiguration(db, admin, `project/${project.id}`)).version).toBe(3);
  });

  it('dryRun 不写配置', async () => {
    const project = await ensureProject(db, admin, { repository: 'github.com/test/preview', name: 'Before' });
    await applyConfiguration(env, db, admin, {
      change: {
        kind: 'project',
        id: project.id,
        value: { name: 'Preview', billingMode: 'wallet', defaults: {}, isActive: true },
      },
      expectedVersion: 0,
      idempotencyKey: 'preview-configuration',
      dryRun: true,
    });
    expect((await getProject(db, admin, project.id)).name).toBe('Before');
    expect((await getConfiguration(db, admin, `project/${project.id}`)).version).toBe(0);
  });
});

describe('计量和实扣分离', () => {
  it('内部费用不会污染钱包累计实扣；缺失用量不填零', async () => {
    const userId = 'control-accounting';
    await seedApiKey(userId, 0);
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO usage_logs (id,user_id,cost,charged_cost,billing_mode,usage_status) VALUES ('meter-reported',?,4,0,'meter_only','reported')",
      ).bind(userId),
      env.DB.prepare(
        "INSERT INTO usage_logs (id,user_id,cost,charged_cost,billing_mode,usage_status) VALUES ('meter-missing',?,NULL,0,'meter_only','missing')",
      ).bind(userId),
    ]);
    expect((await getBalanceSnapshot(db, userId, env.KV)).lifetime_spent_cents).toBe(0);
    const missing = (await listUsage(db, userId)).items.find((item) => item.id === 'meter-missing');
    expect(missing).toMatchObject({
      cost: null,
      cost_cents: null,
      charged_cost: 0,
      input_tokens: null,
      usage_status: 'missing',
    });
  });
});
