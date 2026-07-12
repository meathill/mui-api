import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seedApiKey } from './helpers';

function request(path: string, apiKey: string, init: RequestInit = {}) {
  return SELF.fetch(`http://localhost/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, ...init.headers },
  });
}

describe('Grok 异步视频生成', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('提交后 pending 不扣款，done 按 ticks 结算且重复轮询不重复扣费', async () => {
    const userId = `video-flow-${Date.now()}`;
    const apiKey = await seedApiKey(userId, 10);
    let pollCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v1/videos/generations')) {
        expect(init?.method).toBe('POST');
        expect(new Headers(init?.headers).get('authorization')).toBeNull();
        expect(JSON.parse(String(init?.body))).toMatchObject({
          model: 'grok-imagine-video',
          duration: 2,
          resolution: '480p',
          aspect_ratio: '16:9',
        });
        return Response.json({ request_id: 'video-request-flow' });
      }
      if (url.endsWith('/v1/videos/video-request-flow')) {
        pollCount += 1;
        if (pollCount === 1) return Response.json({ status: 'pending', progress: 30 });
        return Response.json({
          status: 'done',
          model: 'grok-imagine-video',
          video: { url: 'https://example.test/video.mp4', duration: 2 },
          usage: { cost_in_usd_ticks: 1_000_000_000 },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const submitted = await request('/videos/generations', apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'grok-imagine-video', prompt: 'A running corgi', duration: 2 }),
    });
    expect(submitted.status).toBe(200);
    expect(await submitted.json()).toEqual({ request_id: 'video-request-flow' });

    const pending = await request('/videos/video-request-flow', apiKey);
    expect(pending.status).toBe(200);
    expect((await pending.json<{ status: string }>()).status).toBe('pending');
    expect((await env.KV.get<{ balance: number }>(`user:${userId}`, 'json'))?.balance).toBe(10);

    const done = await request('/videos/video-request-flow', apiKey);
    expect(done.status).toBe(200);
    expect((await done.json<{ status: string }>()).status).toBe('done');
    expect((await env.KV.get<{ balance: number }>(`user:${userId}`, 'json'))?.balance).toBeCloseTo(9.895, 6);

    const repeated = await request('/videos/video-request-flow', apiKey);
    expect(repeated.status).toBe(200);
    expect((await env.KV.get<{ balance: number }>(`user:${userId}`, 'json'))?.balance).toBeCloseTo(9.895, 6);
    const log = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM usage_logs WHERE id = 'video:video-request-flow'",
    ).first<{ count: number }>();
    expect(log?.count).toBe(1);
  });

  it('余额不足时不调用上游', async () => {
    const apiKey = await seedApiKey(`video-broke-${Date.now()}`, 0.02);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await request('/videos/generations', apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'grok-imagine-video-1.5',
        prompt: 'Animate it',
        duration: 15,
        resolution: '1080p',
        image: { url: 'https://example.test/input.png' },
      }),
    });
    expect(response.status).toBe(402);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('拒绝 1.5 缺图，并隐藏其他用户的任务', async () => {
    const ownerKey = await seedApiKey(`video-owner-${Date.now()}`, 10);
    const otherKey = await seedApiKey(`video-other-${Date.now()}`, 10);
    const invalid = await request('/videos/generations', ownerKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'grok-imagine-video-1.5', prompt: 'Animate it', duration: 5 }),
    });
    expect(invalid.status).toBe(400);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ request_id: 'private-video-request' })),
    );
    const submitted = await request('/videos/generations', ownerKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'grok-imagine-video', prompt: 'Animate it', duration: 1 }),
    });
    expect(submitted.status).toBe(200);
    const hidden = await request('/videos/private-video-request', otherKey);
    expect(hidden.status).toBe(404);
  });

  it('failed 释放预占，使同一余额可以再次提交', async () => {
    const userId = `video-failed-${Date.now()}`;
    const apiKey = await seedApiKey(userId, 0.06);
    let submission = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith('/v1/videos/generations')) {
          submission += 1;
          return Response.json({ request_id: `failed-request-${submission}` });
        }
        return Response.json({ status: 'failed' });
      }),
    );

    const body = JSON.stringify({ model: 'grok-imagine-video', prompt: 'test', duration: 1 });
    const first = await request('/videos/generations', apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    expect(first.status).toBe(200);
    expect((await request('/videos/failed-request-1', apiKey)).status).toBe(200);
    const second = await request('/videos/generations', apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    expect(second.status).toBe(200);
  });
});
