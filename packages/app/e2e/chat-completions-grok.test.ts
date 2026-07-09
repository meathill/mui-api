import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seedApiKey } from './helpers';

describe('POST /v1/chat/completions —— xAI Grok（经 CF AI Gateway BYOK）', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('非流式：打到 grok 原生网关端点，只带 cf-aig-authorization（xAI key 走 CF Gateway Stored Keys），按 openai 形 usage 精确计费', async () => {
    const userId = `test-grok-bill-${Date.now()}`;
    const billKey = await seedApiKey(userId, 10);

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        id: 'chatcmpl-grok',
        object: 'chat.completion',
        created: 1,
        model: 'grok-4.3',
        usage: { prompt_tokens: 1000, completion_tokens: 200 },
        choices: [{ index: 0, message: { role: 'assistant', content: 'pong' }, finish_reason: 'stop' }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${billKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'grok-4.3', messages: [{ role: 'user', content: 'ping' }] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json<{ choices: Array<{ message: { content: string } }> }>();
    expect(body.choices[0].message.content).toBe('pong');

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://gateway.ai.cloudflare.com/v1/test-account/test-gateway/grok/v1/chat/completions');
    const h = new Headers(init?.headers);
    expect(h.get('cf-aig-authorization')).toBe('Bearer test-token');
    // xAI key 以 CF AI Gateway Stored Keys 形式配置，本服务不持有、不注入 Authorization
    expect(h.get('authorization')).toBeNull();
    const sentBody = JSON.parse(String(init?.body)) as { model: string };
    expect(sentBody.model).toBe('grok-4.3');

    // grok-4.3 种子：input 1.25 / output 2.5（$ / 1M tokens），markup 1.2x，无 cache
    // cost = (1000*1.25 + 200*2.5) / 1e6 * 1.2 = 0.0021
    await vi.waitFor(async () => {
      const userData = await env.KV.get<{ balance: number }>(`user:${userId}`, 'json');
      expect(userData?.balance).toBeCloseTo(9.9979, 4);
    });
  });

  it('流式：SSE 原样透传给客户端，且按尾 chunk usage 精确计费', async () => {
    const userId = `test-grok-stream-bill-${Date.now()}`;
    const billKey = await seedApiKey(userId, 10);

    const sseChunks = [
      'data: {"model":"grok-4.3","choices":[{"delta":{"content":"Hi"}}]}\n\n',
      'data: {"model":"grok-4.3","choices":[],"usage":{"prompt_tokens":1000,"completion_tokens":200}}\n\n',
      'data: [DONE]\n\n',
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (_input: RequestInfo | URL, _init?: RequestInit) =>
          new Response(
            new ReadableStream({
              start(controller) {
                for (const chunk of sseChunks) {
                  controller.enqueue(new TextEncoder().encode(chunk));
                }
                controller.close();
              },
            }),
            { headers: { 'Content-Type': 'text/event-stream' } },
          ),
      ),
    );

    const res = await SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${billKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'grok-4.3', messages: [{ role: 'user', content: 'ping' }], stream: true }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe(sseChunks.join(''));

    await vi.waitFor(async () => {
      const userData = await env.KV.get<{ balance: number }>(`user:${userId}`, 'json');
      expect(userData?.balance).toBeCloseTo(9.9979, 4);
    });
  });
});
