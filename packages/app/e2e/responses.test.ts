import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { seedApiKey } from './helpers';

describe('POST /v1/responses（OpenAI 原生 Responses API）', () => {
  let apiKey: string;

  beforeAll(async () => {
    apiKey = await seedApiKey('test-user-responses', 10);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('缺少 model 参数返回 400', async () => {
    const res = await SELF.fetch('http://localhost/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'hi' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('invalid_request_error');
  });

  it('input 类型不对返回 400', async () => {
    const res = await SELF.fetch('http://localhost/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', input: 42 }),
    });
    expect(res.status).toBe(400);
  });

  it('未知模型返回 404', async () => {
    const res = await SELF.fetch('http://localhost/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'unknown-model', input: 'hi' }),
    });
    expect(res.status).toBe(404);
  });

  it('非 openai 模型被拒绝（仅支持 OpenAI）', async () => {
    const res = await SELF.fetch('http://localhost/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', input: 'hi' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json<{ error: { type: string; message: string } }>();
    expect(body.error.type).toBe('invalid_request_error');
    expect(body.error.message).toContain('openai');
  });

  it('余额不足返回 402', async () => {
    const brokeKey = await seedApiKey(`test-responses-broke-${Date.now()}`, 0);
    const res = await SELF.fetch('http://localhost/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${brokeKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', input: 'hi' }),
    });
    expect(res.status).toBe(402);
  });

  it('未提供 input 也允许（Responses API 里 input 是可选字段，可仅靠 previous_response_id 续话）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          id: 'resp_no_input',
          object: 'response',
          model: 'gpt-4o',
          status: 'completed',
          output: [],
          usage: { input_tokens: 5, output_tokens: 1 },
        }),
      ),
    );

    const res = await SELF.fetch('http://localhost/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', previous_response_id: 'resp_prev' }),
    });
    expect(res.status).toBe(200);
  });

  it('非流式：透传响应，并按 input_tokens_details.cached_tokens 精确拆分计费', async () => {
    const userId = `test-responses-bill-${Date.now()}`;
    const billKey = await seedApiKey(userId, 10);

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        id: 'resp_test',
        object: 'response',
        model: 'gpt-4o-cached-test',
        status: 'completed',
        output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'pong' }] }],
        usage: {
          input_tokens: 1000,
          input_tokens_details: { cached_tokens: 800 },
          output_tokens: 200,
          output_tokens_details: { reasoning_tokens: 10 },
          total_tokens: 1200,
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await SELF.fetch('http://localhost/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${billKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-cached-test', input: 'ping' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json<{ id: string }>();
    expect(body.id).toBe('resp_test');

    // 确实打到 CF AI Gateway 的 openai/responses 端点，并改写了 model
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/openai/responses');
    const h = new Headers(init?.headers);
    expect(h.get('authorization')).toBe('Bearer test-token');
    const sentBody = JSON.parse(String(init?.body)) as { model: string; input: string };
    expect(sentBody.model).toBe('gpt-4o-cached-test');
    expect(sentBody.input).toBe('ping');

    // gpt-4o-cached-test 种子：input 2.5 / cached 1.25 / output 10（$ / 1M tokens），markup 1.2x
    // 非 cache input = 1000 - 800 = 200；cost = (200*2.5 + 800*1.25 + 200*10) / 1e6 * 1.2 = 0.0042
    // 若 cached_tokens 被误读为 0（修复前的 bug：只认 prompt_tokens_details），会把全部 1000
    // 都按非 cache 价计费，cost 变成 0.0054——这条断言在 e2e 层面锁住这次计费修复。
    await vi.waitFor(async () => {
      const userData = await env.KV.get<{ balance: number }>(`user:${userId}`, 'json');
      expect(userData?.balance).toBeCloseTo(9.9958, 4);
    });
  });

  it('流式：SSE 原样透传给客户端，且按终态事件嵌套 usage 精确计费', async () => {
    const userId = `test-responses-stream-bill-${Date.now()}`;
    const billKey = await seedApiKey(userId, 10);

    const sseChunks = [
      'data: {"type":"response.created","response":{"id":"resp_stream","status":"in_progress"}}\n\n',
      'data: {"type":"response.output_text.delta","delta":"Hi"}\n\n',
      'data: {"type":"response.completed","response":{"id":"resp_stream","model":"gpt-4o-cached-test","status":"completed","usage":{"input_tokens":1000,"input_tokens_details":{"cached_tokens":800},"output_tokens":200,"output_tokens_details":{"reasoning_tokens":10},"total_tokens":1200}}}\n\n',
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

    const res = await SELF.fetch('http://localhost/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${billKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-cached-test', input: 'ping', stream: true }),
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe(sseChunks.join(''));

    // 和非流式用例同样的 usage 数字，验证流式路径下终态事件的嵌套 usage 也能正确拆分计费
    await vi.waitFor(async () => {
      const userData = await env.KV.get<{ balance: number }>(`user:${userId}`, 'json');
      expect(userData?.balance).toBeCloseTo(9.9958, 4);
    });
  });
});
