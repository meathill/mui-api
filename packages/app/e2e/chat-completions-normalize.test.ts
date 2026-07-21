import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { seedApiKey } from './helpers';

/**
 * 覆盖 provider 参数归一化（chat-body-normalize）、Gemini OpenAI 兼容翻译层
 * 与上游 4xx 状态码透传（upstreamError）。
 */
describe('POST /v1/chat/completions —— 参数归一化与错误透传', () => {
  let apiKey: string;

  beforeAll(async () => {
    apiKey = await seedApiKey('test-normalize-user');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function chatRequest(body: Record<string, unknown>) {
    return SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('openai：max_tokens 改写为 max_completion_tokens 后再转发', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        id: 'chatcmpl-openai',
        object: 'chat.completion',
        created: 1,
        model: 'gpt-4o',
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await chatRequest({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 1024,
    });

    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(sentBody.max_completion_tokens).toBe(1024);
    expect(sentBody).not.toHaveProperty('max_tokens');
  });

  it('grok：strip 推理模型不支持的 stop / presence_penalty / frequency_penalty', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        id: 'chatcmpl-grok',
        object: 'chat.completion',
        created: 1,
        model: 'grok-4.3',
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await chatRequest({
      model: 'grok-4.3',
      messages: [{ role: 'user', content: 'hello' }],
      max_tokens: 100,
      stop: ['\n'],
      presence_penalty: 0.5,
      frequency_penalty: 0.5,
    });

    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(sentBody.max_tokens).toBe(100);
    expect(sentBody).not.toHaveProperty('stop');
    expect(sentBody).not.toHaveProperty('presence_penalty');
    expect(sentBody).not.toHaveProperty('frequency_penalty');
  });

  it('gemini：标准 OpenAI body 翻译为 contents，响应翻译回 chat.completion 并按 openai 形计费', async () => {
    const userId = `test-gemini-compat-${Date.now()}`;
    const geminiKey = await seedApiKey(userId, 10);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        candidates: [{ content: { role: 'model', parts: [{ text: 'pong' }] }, finishReason: 'STOP', index: 0 }],
        usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200, totalTokenCount: 1200 },
        modelVersion: 'gemini-2.5-flash',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${geminiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'be nice' },
          { role: 'user', content: 'ping' },
        ],
        max_tokens: 512,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json<{
      object: string;
      choices: Array<{ message: { role: string; content: string }; finish_reason: string }>;
      usage: { prompt_tokens: number; completion_tokens: number };
    }>();
    expect(body.object).toBe('chat.completion');
    expect(body.choices[0].message).toEqual({ role: 'assistant', content: 'pong' });
    expect(body.choices[0].finish_reason).toBe('stop');
    expect(body.usage).toMatchObject({ prompt_tokens: 1000, completion_tokens: 200 });

    // 上游收到的是 Gemini 原生 shape：contents + systemInstruction，没有 messages
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('generateContent');
    const sentText = String(init?.body);
    expect(sentText).toContain('"contents"');
    expect(sentText).toContain('be nice');
    expect(sentText).not.toContain('"messages"');

    // usage 翻译为 OpenAI 形后按 openai 解析计费（余额应减少）
    await vi.waitFor(async () => {
      const userData = await env.KV.get<{ balance: number }>(`user:${userId}`, 'json');
      expect(userData?.balance).toBeLessThan(10);
    });
  });

  it('gemini：流式响应翻译为 chat.completion.chunk SSE 并以 [DONE] 结尾', async () => {
    const sse = [
      'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"Hi"}]},"index":0}]}\n\n',
      'data: {"candidates":[{"content":{"role":"model","parts":[{"text":"!"}]},"finishReason":"STOP","index":0}],"usageMetadata":{"promptTokenCount":5,"candidatesTokenCount":2,"totalTokenCount":7}}\n\n',
    ].join('');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(new TextEncoder().encode(sse).slice().buffer, {
            headers: { 'Content-Type': 'text/event-stream' },
          }),
      ),
    );

    const res = await chatRequest({
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    });

    expect(res.status).toBe(200);
    const text = await res.text();
    const chunks = text
      .split('\n\n')
      .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
      .map((line) => JSON.parse(line.slice(6)) as Record<string, unknown>);
    expect(text.trimEnd().endsWith('data: [DONE]')).toBe(true);
    expect(chunks.every((chunk) => chunk.object === 'chat.completion.chunk')).toBe(true);
    const joined = chunks
      .map((chunk) => ((chunk.choices as Array<{ delta: { content?: string } }>)[0]?.delta.content ?? '') as string)
      .join('');
    expect(joined).toBe('Hi!');
    const finishChunk = chunks.at(-1) as { choices: Array<{ finish_reason: string }>; usage?: unknown };
    expect(finishChunk.choices[0].finish_reason).toBe('stop');
    expect(finishChunk.usage).toMatchObject({ prompt_tokens: 5, completion_tokens: 2 });
  });

  it('gemini：tools 请求返回 400 说明暂不支持', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await chatRequest({
      model: 'gemini-2.5-flash',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ type: 'function', function: { name: 'f' } }],
    });

    expect(res.status).toBe(400);
    const body = await res.json<{ error: { message: string } }>();
    expect(body.error.message).toContain('暂不支持 tools');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('上游 400 原状态码透传给客户端（moonshot 直连路径）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: { message: 'Invalid request: bad param' } }, { status: 400 })),
    );

    const res = await chatRequest({
      model: 'kimi-k3',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 1.5,
    });

    expect(res.status).toBe(400);
    const body = await res.json<{ error: { type: string; message: string } }>();
    expect(body.error.type).toBe('invalid_request_error');
    expect(body.error.message).toContain('bad param');
  });

  it('上游 400 透传（openai SDK 抛错路径）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: { message: "Unsupported parameter: 'max_tokens' is not supported with this model." } },
          { status: 400 },
        ),
      ),
    );

    const res = await chatRequest({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(res.status).toBe(400);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('invalid_request_error');
  });

  it('上游 401 属于网关凭证问题，仍包成 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: { message: 'bad key' } }, { status: 401 })),
    );

    const res = await chatRequest({
      model: 'kimi-k3',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(res.status).toBe(502);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('api_error');
  });
});
