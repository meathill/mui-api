import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CloudflareBindings } from '../types';
import { callGrokEndpoint, callXiaomiMiMo } from './provider-dispatch';

function createEnv(overrides: Partial<CloudflareBindings> = {}): CloudflareBindings {
  return {
    MIMO_API_KEY: 'test-mimo-key',
    ...overrides,
  } as CloudflareBindings;
}

function createGrokEnv(overrides: Partial<CloudflareBindings> = {}): CloudflareBindings {
  return {
    CF_ACCOUNT_ID: 'test-account',
    CF_GATEWAY_ID: 'test-gateway',
    CF_AIG_TOKEN: 'test-aig-token',
    ...overrides,
  } as CloudflareBindings;
}

describe('callXiaomiMiMo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('直接调用 Xiaomi MiMo OpenAI 兼容端点并使用 MIMO_API_KEY', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return Response.json({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        model: 'mimo-v2.5-pro',
        usage: { prompt_tokens: 3, completion_tokens: 5 },
        choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await callXiaomiMiMo(createEnv(), {
      model: 'mimo-v2.5-pro',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0];
    expect(input).toBe('https://api.xiaomimimo.com/v1/chat/completions');
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer test-mimo-key');
    expect(headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'mimo-v2.5-pro',
      messages: [{ role: 'user', content: 'hello' }],
    });
  });

  it('支持通过 MIMO_BASE_URL 覆盖 OpenAI 兼容接口地址', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await callXiaomiMiMo(createEnv({ MIMO_BASE_URL: 'https://mimo.example.test/custom/' }), {
      model: 'mimo-v2.5-pro',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input] = fetchMock.mock.calls[0];
    expect(input).toBe('https://mimo.example.test/custom/chat/completions');
  });

  it('缺少 MIMO_API_KEY 时拒绝调用', async () => {
    await expect(
      callXiaomiMiMo(createEnv({ MIMO_API_KEY: undefined }), {
        model: 'mimo-v2.5-pro',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toThrow('缺少 MIMO_API_KEY');
  });
});

describe('callGrokEndpoint', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('经 CF AI Gateway 转发聊天补全，只带 cf-aig-authorization，不注入 Authorization（xAI key 走 Stored Keys）', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return Response.json({
        id: 'chatcmpl-test',
        model: 'grok-4.3',
        usage: { prompt_tokens: 3, completion_tokens: 5 },
        choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await callGrokEndpoint(
      createGrokEnv(),
      '/v1/chat/completions',
      JSON.stringify({ model: 'grok-4.3', messages: [{ role: 'user', content: 'hello' }] }),
      { 'content-type': 'application/json' },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0];
    expect(input).toBe('https://gateway.ai.cloudflare.com/v1/test-account/test-gateway/grok/v1/chat/completions');
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('cf-aig-authorization')).toBe('Bearer test-aig-token');
    // xAI key 以 CF AI Gateway Stored Keys 形式配置，本服务不持有、不注入 Authorization
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('图片生成走同一个函数，path 拼到 /v1/images/generations', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await callGrokEndpoint(
      createGrokEnv(),
      '/v1/images/generations',
      JSON.stringify({ model: 'grok-imagine-image', prompt: 'a cat' }),
    );

    const [input] = fetchMock.mock.calls[0];
    expect(input).toBe('https://gateway.ai.cloudflare.com/v1/test-account/test-gateway/grok/v1/images/generations');
  });

  it('视频轮询使用 GET 且不发送 body', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({ status: 'pending' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await callGrokEndpoint(createGrokEnv(), '/v1/videos/request-1', undefined, {}, 'GET');
    const [input, init] = fetchMock.mock.calls[0];
    expect(input).toBe('https://gateway.ai.cloudflare.com/v1/test-account/test-gateway/grok/v1/videos/request-1');
    expect(init?.method).toBe('GET');
    expect(init?.body).toBeUndefined();
  });
});
