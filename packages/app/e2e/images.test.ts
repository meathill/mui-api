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

  it('打到 grok 原生网关端点（xAI key 走 CF Gateway Stored Keys），响应无 usage 字段时按返回图片数量兜底计费', async () => {
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
    const sentBody = JSON.parse(String(init?.body)) as { model: string; prompt: string };
    expect(sentBody.model).toBe('grok-imagine-image');
    expect(sentBody.prompt).toBe('a golden retriever puppy');

    // grok-imagine-image 种子：outputPrice 20000（占位换算自假设的 $0.02/张），markup 1.2x
    // 响应无 usage 字段 → 按 data 数组长度兜底计费：cost = 2 * 20000 / 1e6 * 1.2 = 0.048
    await vi.waitFor(async () => {
      const userData = await env.KV.get<{ balance: number }>(`user:${userId}`, 'json');
      expect(userData?.balance).toBeCloseTo(9.952, 4);
    });
  });
});

describe('POST /v1/images/edits', () => {
  let apiKey: string;

  beforeAll(async () => {
    apiKey = await seedApiKey('test-user-image-edits');
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
