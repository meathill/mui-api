import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seedApiKey } from './helpers';

const EXPECTED_BALANCE = 9.995392;

describe('POST /v1/chat/completions —— Moonshot Kimi K3', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('文本非流式：直连 Moonshot、原样透传高级参数并按缓存输入精确计费', async () => {
    const userId = `test-kimi-k3-bill-${Date.now()}`;
    const apiKey = await seedApiKey(userId, 10);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        id: 'chatcmpl-kimi-k3',
        model: 'kimi-k3',
        usage: { prompt_tokens: 1000, completion_tokens: 200, cached_tokens: 800 },
        choices: [{ index: 0, message: { role: 'assistant', content: 'pong' }, finish_reason: 'stop' }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const requestBody = {
      model: 'kimi-k3',
      messages: [{ role: 'user', content: 'ping' }],
      reasoning_effort: 'max',
      tools: [{ type: 'function', function: { name: 'lookup' } }],
      tool_choice: 'auto',
      response_format: { type: 'json_object' },
    };

    const response = await SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    expect(response.status).toBe(200);
    expect(
      (await response.json<{ choices: Array<{ message: { content: string } }> }>()).choices[0].message.content,
    ).toBe('pong');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.moonshot.ai/v1/chat/completions');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-moonshot-key');
    expect(JSON.parse(String(init?.body))).toEqual(requestBody);

    // (200 × $3 + 800 × $0.30 + 200 × $15) / 1M × 1.2 = $0.004608
    await vi.waitFor(async () => {
      const userData = await env.KV.get<{ balance: number }>(`user:${userId}`, 'json');
      expect(userData?.balance).toBeCloseTo(EXPECTED_BALANCE, 6);
    });
  });

  it('视觉输入：标准 image_url content parts 原样透传', async () => {
    const apiKey = await seedApiKey(`test-kimi-k3-vision-${Date.now()}`, 10);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        model: 'kimi-k3',
        usage: { prompt_tokens: 1, completion_tokens: 1, cached_tokens: 0 },
        choices: [{ message: { role: 'assistant', content: '一张图片' } }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } },
          { type: 'text', text: '描述图片' },
        ],
      },
    ];

    const response = await SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'kimi-k3', messages }),
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ model: 'kimi-k3', messages });
  });

  it('流式：透传 reasoning_content，并从 choices[0].usage 精确计费', async () => {
    const userId = `test-kimi-k3-stream-${Date.now()}`;
    const apiKey = await seedApiKey(userId, 10);
    const chunks = [
      'data: {"model":"kimi-k3","choices":[{"delta":{"reasoning_content":"思考"}}]}\n\n',
      'data: {"model":"kimi-k3","choices":[{"delta":{"content":"答案"}}]}\n\n',
      'data: {"model":"kimi-k3","choices":[{"delta":{},"usage":{"prompt_tokens":1000,"completion_tokens":200,"cached_tokens":800}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(
          new ReadableStream({
            start(controller) {
              for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
              controller.close();
            },
          }),
          { headers: { 'Content-Type': 'text/event-stream' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'kimi-k3',
        messages: [{ role: 'user', content: '回答问题' }],
        reasoning_effort: 'max',
        stream: true,
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(chunks.join(''));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      model: 'kimi-k3',
      messages: [{ role: 'user', content: '回答问题' }],
      reasoning_effort: 'max',
      stream: true,
    });
    await vi.waitFor(async () => {
      const userData = await env.KV.get<{ balance: number }>(`user:${userId}`, 'json');
      expect(userData?.balance).toBeCloseTo(EXPECTED_BALANCE, 6);
    });
  });
});
