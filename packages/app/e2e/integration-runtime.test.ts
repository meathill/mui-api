import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDb } from '../src/db';
import { ensureProject, issueProjectKey } from '../src/services/control-projects';
import { applyConfiguration } from '../src/services/control-configuration';
import type { ControlActor } from '../src/services/control-auth';
import { seedApiKey } from './helpers';

const db = createDb(env.DB);
const actor: ControlActor = {
  userId: 'runtime-meter-owner',
  isAdmin: true,
  scopes: ['projects:read', 'projects:write', 'keys:write', 'configuration:write'],
};
async function setupProject(name: string, defaults: Record<string, string> = {}) {
  await seedApiKey(actor.userId, 0, { freeQuotaUsed: 0.25 });
  const project = await ensureProject(db, actor, {
    repository: `github.com/test/${name}`,
    name,
    billingMode: 'meter_only',
    defaults,
  });
  const key = await issueProjectKey(env, db, actor, project.id);
  return { project, key: key.rawKey };
}
function request(key: string, endpoint: string, body?: unknown) {
  return SELF.fetch(`http://localhost/v1/${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
afterEach(async () => {
  vi.unstubAllGlobals();
  await env.KV.delete('config:global');
});

describe('内部项目运行链路', () => {
  it('零余额仍可调用，保留用量和费用，不抵扣免费额度', async () => {
    const { project, key } = await setupProject('meter-chat', { chat: 'mimo-v2.5-pro' });
    await env.KV.put(
      'config:global',
      JSON.stringify({ freeQuota: { enabled: true, amount: 10, modelIds: ['mimo-v2.5-pro'] } }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          model: 'mimo-v2.5-pro',
          choices: [{ message: { content: 'OK' } }],
          usage: { prompt_tokens: 1000, completion_tokens: 200 },
        }),
      ),
    );
    const response = await request(key, 'chat/completions', {
      model: 'default',
      messages: [{ role: 'user', content: 'hello' }],
    });
    expect(response.status, await response.clone().text()).toBe(200);
    await response.json();
    await vi.waitFor(async () => {
      const usage = await env.DB.prepare('SELECT * FROM usage_logs WHERE project_id = ?')
        .bind(project.id)
        .first<{ cost: number; charged_cost: number; billing_mode: string; input_tokens: number }>();
      expect(usage).toMatchObject({ charged_cost: 0, billing_mode: 'meter_only', input_tokens: 1000 });
      expect(usage?.cost).toBeGreaterThan(0);
    });
    expect(await env.KV.get(`user:${actor.userId}`, 'json')).toMatchObject({ balance: 0, freeQuotaUsed: 0.25 });
  });

  it('中心默认更改即时生效，项目覆盖与请求显式模型不受影响', async () => {
    const following = await setupProject('follow-default');
    const override = await setupProject('override-default', { chat: 'mimo-v2.5-pro' });
    const models: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { model: string };
        models.push(body.model);
        return Response.json({
          model: body.model,
          choices: [{ message: { content: 'OK' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        });
      }),
    );
    await applyConfiguration(env, db, actor, {
      change: { kind: 'defaults', value: { chat: 'mimo-v2.5-pro' } },
      expectedVersion: 0,
      idempotencyKey: 'runtime-default-one',
    });
    await (await request(following.key, 'chat/completions', { messages: [{ role: 'user', content: 'hello' }] })).text();
    await applyConfiguration(env, db, actor, {
      change: { kind: 'defaults', value: { chat: 'kimi-k3' } },
      expectedVersion: 1,
      idempotencyKey: 'runtime-default-two',
    });
    for (const [key, model] of [
      [following.key, 'default'],
      [override.key, 'default'],
      [following.key, 'mimo-v2.5-pro'],
    ]) {
      const response = await request(key!, 'chat/completions', {
        model,
        messages: [{ role: 'user', content: 'hello' }],
      });
      expect(response.status, await response.clone().text()).toBe(200);
      await response.text();
    }
    expect(models).toEqual(['mimo-v2.5-pro', 'kimi-k3', 'mimo-v2.5-pro', 'mimo-v2.5-pro']);
  });

  it('无 usage 的成功响应记录为 missing，不伪造零 token', async () => {
    const { project, key } = await setupProject('missing-usage', { chat: 'mimo-v2.5-pro' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ choices: [{ message: { content: 'OK' } }] })),
    );
    await (await request(key, 'chat/completions', { messages: [{ role: 'user', content: 'hello' }] })).text();
    await vi.waitFor(async () => {
      expect(
        await env.DB.prepare('SELECT input_tokens,cost,charged_cost,usage_status FROM usage_logs WHERE project_id = ?')
          .bind(project.id)
          .first(),
      ).toEqual({ input_tokens: null, cost: null, charged_cost: 0, usage_status: 'missing' });
    });
  });

  it('视频不预占、不扣费，提交后改为 wallet 仍按快照只计量', async () => {
    const { project, key } = await setupProject('meter-video');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: unknown) =>
        String(url).endsWith('/generations')
          ? Response.json({ request_id: 'meter-video-job' })
          : Response.json({
              status: 'done',
              model: 'grok-imagine-video',
              video: { url: 'https://example.com/video.mp4', duration: 2 },
              usage: { cost_in_usd_ticks: 1_000_000_000 },
            }),
      ),
    );
    const submitted = await request(key, 'videos/generations', {
      model: 'grok-imagine-video',
      prompt: 'test',
      duration: 2,
    });
    expect(submitted.status, await submitted.clone().text()).toBe(200);
    await submitted.text();
    await applyConfiguration(env, db, actor, {
      change: {
        kind: 'project',
        id: project.id,
        value: { name: 'meter-video', billingMode: 'wallet', defaults: {}, isActive: true },
      },
      expectedVersion: 0,
      idempotencyKey: 'video-mode-change',
    });
    for (let i = 0; i < 2; i++) {
      const response = await request(key, 'videos/meter-video-job');
      expect(response.status, await response.clone().text()).toBe(200);
      await response.text();
    }
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) AS count, charged_cost, billing_mode FROM usage_logs WHERE id = 'video:meter-video-job'",
      ).first(),
    ).toEqual({ count: 1, charged_cost: 0, billing_mode: 'meter_only' });
    expect(await env.KV.get(`user:${actor.userId}`, 'json')).toMatchObject({ balance: 0, freeQuotaUsed: 0.25 });
  });
});
