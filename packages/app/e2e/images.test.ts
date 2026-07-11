import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { seedApiKey } from './helpers';

describe('POST /v1/images/generations', () => {
  let apiKey: string;

  beforeAll(async () => {
    apiKey = await seedApiKey('test-user-images');
  });

  it('缺少 model 参数返回 400', async () => {
    const res = await SELF.fetch('http://localhost/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'a clean product photo' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('invalid_request_error');
  });

  it('缺少 prompt 参数返回 400', async () => {
    const res = await SELF.fetch('http://localhost/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'gpt-image-2' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('invalid_request_error');
  });

  it('未知图片模型返回 404', async () => {
    const res = await SELF.fetch('http://localhost/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'unknown-image-model', prompt: 'a clean product photo' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('invalid_request_error');
  });
});

describe('POST /v1/images/generations —— xAI Grok（经 CF AI Gateway BYOK）', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('打到 Grok 原生端点并按返回图片数量换算内部 token 兜底计费', async () => {
    const userId = `test-grok-image-bill-${Date.now()}`;
    const billKey = await seedApiKey(userId, 10);

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        model: 'grok-imagine-image',
        data: [{ url: 'https://example.test/1.png' }, { url: 'https://example.test/2.png' }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await SELF.fetch('http://localhost/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${billKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'grok-imagine-image', prompt: 'a golden retriever puppy' }),
    });

    expect(res.status).toBe(200);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      'https://gateway.ai.cloudflare.com/v1/test-account/test-gateway/grok/v1/images/generations',
    );
    const h = new Headers(init?.headers);
    expect(h.get('cf-aig-authorization')).toBe('Bearer test-token');
    expect(h.get('authorization')).toBeNull();
    const sentBody = JSON.parse(String(init?.body));
    expect(sentBody).toEqual({
      model: 'grok-imagine-image',
      prompt: 'a golden retriever puppy',
      n: 1,
      resolution: '1k',
      response_format: 'url',
    });

    // 两张基础模型输出：$0.04 → 40,000 内部 token；应用 1.05 markup 后为 $0.042。
    await vi.waitFor(async () => {
      const userData = await env.KV.get<{ balance: number }>(`user:${userId}`, 'json');
      expect(userData?.balance).toBeCloseTo(9.958, 4);
    });
  });

  it('优先按 xAI cost ticks 换算内部 token', async () => {
    const userId = `test-grok-image-ticks-${Date.now()}`;
    const billKey = await seedApiKey(userId, 10);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          model: 'grok-imagine-image',
          data: [{ url: 'https://example.test/result.png' }],
          usage: { cost_in_usd_ticks: 200_000_000 },
        }),
      ),
    );

    const res = await SELF.fetch('http://localhost/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${billKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'grok-imagine-image', prompt: 'a puppy', resolution: '2k' }),
    });
    expect(res.status).toBe(200);
    await vi.waitFor(async () => {
      const userData = await env.KV.get<{ balance: number }>(`user:${userId}`, 'json');
      expect(userData?.balance).toBeCloseTo(9.979, 4);
    });
  });

  it('拒绝非法 Grok 生成参数', async () => {
    const apiKey = await seedApiKey(`test-grok-image-invalid-${Date.now()}`);
    const res = await SELF.fetch('http://localhost/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'grok-imagine-image', prompt: 'a puppy', n: 11 }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /v1/images/edits', () => {
  let apiKey: string;

  beforeAll(async () => {
    apiKey = await seedApiKey('test-user-image-edits');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('非 multipart 请求返回 400', async () => {
    const res = await SELF.fetch('http://localhost/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'gpt-image-2', prompt: 'make it brighter' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('invalid_request_error');
  });

  it('Grok quality 支持 JSON 多图编辑并按 2K 价格兜底', async () => {
    const userId = `test-grok-image-edit-${Date.now()}`;
    const billKey = await seedApiKey(userId, 10);
    const fetchMock = vi.fn(async () =>
      Response.json({
        model: 'grok-imagine-image-quality',
        data: [{ url: 'https://example.test/result.png' }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await SELF.fetch('http://localhost/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${billKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'grok-imagine-image-quality',
        prompt: 'combine them',
        images: [
          { type: 'image_url', url: 'data:image/png;base64,AAAA' },
          { type: 'image_url', url: 'data:image/png;base64,BBBB' },
        ],
        aspect_ratio: '3:2',
        resolution: '2k',
        response_format: 'b64_json',
      }),
    });
    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'grok-imagine-image-quality',
      resolution: '2k',
      aspect_ratio: '3:2',
      images: [{ url: 'data:image/png;base64,AAAA' }, { url: 'data:image/png;base64,BBBB' }],
    });
    // 两张输入图 $0.02 + 一张 2K 输出 $0.07 = $0.09；markup 后 $0.0945。
    await vi.waitFor(async () => {
      const userData = await env.KV.get<{ balance: number }>(`user:${userId}`, 'json');
      expect(userData?.balance).toBeCloseTo(9.9055, 4);
    });
  });

  it('Grok 基础模型单图编辑按 ticks 扣除 $0.022 上游成本', async () => {
    const userId = `test-grok-image-single-edit-${Date.now()}`;
    const billKey = await seedApiKey(userId, 10);
    const fetchMock = vi.fn(async () =>
      Response.json({
        model: 'grok-imagine-image',
        data: [{ url: 'https://example.test/result.png' }],
        usage: { cost_in_usd_ticks: 220_000_000 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await SELF.fetch('http://localhost/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${billKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'grok-imagine-image',
        prompt: 'add a hat',
        image: { type: 'image_url', url: 'data:image/png;base64,AAAA' },
      }),
    });
    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'grok-imagine-image',
      image: { type: 'image_url', url: 'data:image/png;base64,AAAA' },
    });
    await vi.waitFor(async () => {
      const userData = await env.KV.get<{ balance: number }>(`user:${userId}`, 'json');
      expect(userData?.balance).toBeCloseTo(9.9769, 4);
    });
  });

  it('缺少 prompt 参数返回 400', async () => {
    const form = new FormData();
    form.append('model', 'gpt-image-2');

    const res = await SELF.fetch('http://localhost/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    expect(res.status).toBe(400);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('invalid_request_error');
  });
});
