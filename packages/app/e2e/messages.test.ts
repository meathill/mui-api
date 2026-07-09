import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { seedApiKey } from './helpers';

describe('POST /v1/messages（Anthropic 原生）', () => {
  let apiKey: string;

  beforeAll(async () => {
    apiKey = await seedApiKey('test-user-messages', 10);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('缺少 model 参数返回 400', async () => {
    const res = await SELF.fetch('http://localhost/v1/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], max_tokens: 16 }),
    });
    expect(res.status).toBe(400);
  });

  it('缺少 messages 参数返回 400', async () => {
    const res = await SELF.fetch('http://localhost/v1/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 16 }),
    });
    expect(res.status).toBe(400);
  });

  it('非 anthropic 模型被拒绝（仅支持 Claude）', async () => {
    const res = await SELF.fetch('http://localhost/v1/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }], max_tokens: 16 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json<{ error: { type: string; message: string } }>();
    expect(body.error.type).toBe('invalid_request_error');
    expect(body.error.message).toContain('Claude');
  });

  it('透传 Claude 响应，按 Anthropic 原生 usage 扣费，且注入 byok 凭证（x-api-key）', async () => {
    const userId = `test-msg-bill-${Date.now()}`;
    const billKey = await seedApiKey(userId, 10);

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-20250514',
        content: [{ type: 'text', text: 'pong' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await SELF.fetch('http://localhost/v1/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${billKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json<{ content: Array<{ text: string }> }>();
    expect(body.content[0].text).toBe('pong');

    // 上游确实打到 CF AI Gateway 的 anthropic 原生端点，并注入 byok 凭证（x-api-key，不带 Authorization）
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/anthropic/v1/messages');
    const h = new Headers(init?.headers);
    expect(h.get('cf-aig-authorization')).toBe('Bearer test-token');
    expect(h.get('authorization')).toBeNull();
    expect(h.get('x-api-key')).toBe('test-anthropic-key');

    // 异步计费扣减余额
    await vi.waitFor(async () => {
      const userData = await env.KV.get<{ balance: number }>(`user:${userId}`, 'json');
      expect(userData?.balance).toBeLessThan(10);
    });
  });

  it('用 x-api-key 鉴权也能调用（Anthropic SDK 默认头）', async () => {
    const userId = `test-msg-xkey-${Date.now()}`;
    const xKey = await seedApiKey(userId, 10);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json({
          id: 'msg_x',
          type: 'message',
          role: 'assistant',
          model: 'claude-sonnet-4-20250514',
          content: [{ type: 'text', text: 'pong' }],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      ),
    );

    const res = await SELF.fetch('http://localhost/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': xKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });

    expect(res.status).toBe(200);
  });
});
