import { env, SELF } from 'cloudflare:test';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { seedApiKey } from './helpers';

describe('POST /v1/chat/completions', () => {
  let apiKey: string;
  let brokeApiKey: string;

  beforeAll(async () => {
    apiKey = await seedApiKey('test-user-1');
    brokeApiKey = await seedApiKey('test-user-broke', 0);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await env.KV.delete('config:global');
  });

  it('缺少 model 参数返回 400', async () => {
    const res = await SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('invalid_request_error');
  });

  it('缺少 messages 参数返回 400', async () => {
    const res = await SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'gpt-4o' }),
    });
    expect(res.status).toBe(400);
  });

  it('余额不足返回 402', async () => {
    const res = await SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${brokeApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });
    expect(res.status).toBe(402);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('insufficient_quota');
  });

  it('余额不足但免费额度适用时允许调用 MiMo 模型', async () => {
    const userId = `test-free-user-${Date.now()}`;
    const freeApiKey = await seedApiKey(userId, 0, { freeQuotaUsed: 0 });
    await env.KV.put(
      'config:global',
      JSON.stringify({
        dailySpendingCap: 0,
        monthlySpendingCap: 0,
        adminEmail: 'admin@example.com',
        isServicePaused: false,
        freeQuota: {
          enabled: true,
          amount: 1,
          modelIds: ['mimo-v2.5-pro'],
        },
      }),
    );

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return Response.json({
        id: 'chatcmpl-mimo-free-test',
        object: 'chat.completion',
        created: 1,
        model: 'mimo-v2.5-pro',
        usage: { prompt_tokens: 9, completion_tokens: 4 },
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'ok' },
            finish_reason: 'stop',
          },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${freeApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mimo-v2.5-pro',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });

    expect(res.status).toBe(200);
    await res.json();
    await vi.waitFor(async () => {
      const userData = await env.KV.get<{ balance: number; freeQuotaUsed?: number }>(`user:${userId}`, 'json');
      expect(userData?.balance).toBe(0);
      expect(userData?.freeQuotaUsed ?? 0).toBeGreaterThan(0);
    });
  });

  it('余额不足且模型不在免费额度范围内返回 402', async () => {
    const freeApiKey = await seedApiKey(`test-free-denied-${Date.now()}`, 0, { freeQuotaUsed: 0 });
    await env.KV.put(
      'config:global',
      JSON.stringify({
        dailySpendingCap: 0,
        monthlySpendingCap: 0,
        adminEmail: 'admin@example.com',
        isServicePaused: false,
        freeQuota: {
          enabled: true,
          amount: 1,
          modelIds: ['mimo-v2.5-pro'],
        },
      }),
    );

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${freeApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });

    expect(res.status).toBe(402);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('insufficient_quota');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('xiaomi-mimo 模型直连 OpenAI 兼容接口并使用 MIMO_API_KEY', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return Response.json({
        id: 'chatcmpl-mimo-test',
        object: 'chat.completion',
        created: 1,
        model: 'mimo-v2.5-pro',
        usage: { prompt_tokens: 9, completion_tokens: 4 },
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'ok' },
            finish_reason: 'stop',
          },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mimo-v2.5-pro',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });

    expect(res.status).toBe(200);
    await res.json();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0];
    expect(input).toBe('https://token-plan-sgp.xiaomimimo.com/v1/chat/completions');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer test-mimo-key');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'mimo-v2.5-pro',
      messages: [{ role: 'user', content: 'hello' }],
    });
  });

  it('xiaomi-mimo TTS 模型透传 audio 参数并返回音频数据', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return Response.json({
        id: 'chatcmpl-mimo-tts-test',
        object: 'chat.completion',
        created: 1,
        model: 'mimo-v2.5-tts',
        usage: { prompt_tokens: 0, completion_tokens: 0 },
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: null, audio: { id: 'audio-1', data: 'UklGRg==' } },
            finish_reason: 'stop',
          },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mimo-v2.5-tts',
        messages: [{ role: 'assistant', content: '你好，欢迎回来。' }],
        audio: { format: 'wav', voice: 'mimo_default' },
        stream: false,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json<{ choices: Array<{ message: { audio: { data: string } } }> }>();
    expect(body.choices[0].message.audio.data).toBe('UklGRg==');
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'mimo-v2.5-tts',
      messages: [{ role: 'assistant', content: '你好，欢迎回来。' }],
      audio: { format: 'wav', voice: 'mimo_default' },
      stream: false,
    });
  });

  it('内置 xiaomi-mimo TTS 模型未入库时仍可透传', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return Response.json({
        id: 'chatcmpl-mimo-tts-clone-test',
        object: 'chat.completion',
        created: 1,
        model: 'mimo-v2.5-tts-voiceclone',
        usage: { prompt_tokens: 0, completion_tokens: 0 },
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: null, audio: { id: 'audio-2', data: 'UklGRg==' } },
            finish_reason: 'stop',
          },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mimo-v2.5-tts-voiceclone',
        messages: [
          { role: 'user', content: '' },
          { role: 'assistant', content: '你好，欢迎回来。' },
        ],
        audio: { format: 'wav', voice: 'data:audio/mpeg;base64,AAAA' },
        stream: false,
      }),
    });

    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'mimo-v2.5-tts-voiceclone',
      audio: { format: 'wav', voice: 'data:audio/mpeg;base64,AAAA' },
    });
  });
});
