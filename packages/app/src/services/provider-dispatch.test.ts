import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CloudflareBindings } from '../types';
import {
  callDeepSeek,
  callGrokEndpoint,
  callMoonshot,
  callOpenCodeGo,
  callXiaomiMiMo,
  generateSessionIdFromTrait,
  resolveOpenCodeSession,
} from './provider-dispatch';

function createEnv(overrides: Partial<CloudflareBindings> = {}): CloudflareBindings {
  return {
    MIMO_API_KEY: 'test-mimo-key',
    ...overrides,
  } as CloudflareBindings;
}

function createOpenCodeGoEnv(overrides: Partial<CloudflareBindings> = {}): CloudflareBindings {
  return {
    OPENCODE_GO_API_KEY: 'test-opencode-go-key',
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

function createMoonshotEnv(overrides: Partial<CloudflareBindings> = {}): CloudflareBindings {
  return {
    MOONSHOT_API_KEY: 'test-moonshot-key',
    ...overrides,
  } as CloudflareBindings;
}

function createDeepSeekEnv(overrides: Partial<CloudflareBindings> = {}): CloudflareBindings {
  return {
    DEEPSEEK_API_KEY: 'test-deepseek-key',
    ...overrides,
  } as CloudflareBindings;
}

describe('callMoonshot', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('直连 Moonshot Chat Completions 并原样透传 K3 参数', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const body = {
      model: 'kimi-k3',
      reasoning_effort: 'max',
      tools: [{ type: 'function', function: { name: 'weather' } }],
      tool_choice: 'auto',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } },
            { type: 'text', text: '描述图片' },
          ],
        },
      ],
      stream: true,
    };

    await callMoonshot(createMoonshotEnv(), body);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0];
    expect(input).toBe('https://api.moonshot.ai/v1/chat/completions');
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer test-moonshot-key');
    expect(headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual(body);
  });

  it('支持通过 MOONSHOT_BASE_URL 覆盖接口地址', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await callMoonshot(createMoonshotEnv({ MOONSHOT_BASE_URL: 'https://moonshot.example.test/custom/' }), {
      model: 'kimi-k3',
      messages: [{ role: 'user', content: 'hello' }],
    });

    const [input] = fetchMock.mock.calls[0];
    expect(input).toBe('https://moonshot.example.test/custom/chat/completions');
  });

  it('配置了 OPENCODE_GO_API_KEY 时，Kimi K3 直接使用 OpenCode Go API 端点分发', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return Response.json({
        id: 'chatcmpl-opencode-go-direct',
        object: 'chat.completion',
        model: 'kimi-k3',
        choices: [{ index: 0, message: { role: 'assistant', content: 'opencode go success' }, finish_reason: 'stop' }],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await callMoonshot(
      createMoonshotEnv({ MOONSHOT_API_KEY: 'test-moonshot-key', OPENCODE_GO_API_KEY: 'test-opencode-go-key' }),
      {
        model: 'kimi-k3',
        messages: [{ role: 'user', content: 'hello' }],
      },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [callInput, callInit] = fetchMock.mock.calls[0];
    expect(callInput).toBe('https://opencode.ai/zen/go/v1/chat/completions');
    const headers = new Headers(callInit?.headers);
    expect(headers.get('authorization')).toBe('Bearer test-opencode-go-key');
  });

  it('缺少 MOONSHOT_API_KEY 时在请求前明确失败', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callMoonshot(createMoonshotEnv({ MOONSHOT_API_KEY: undefined }), {
        model: 'kimi-k3',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toThrow('缺少 MOONSHOT_API_KEY');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('callDeepSeek', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('直连 DeepSeek Chat Completions 接口并传递 DEEPSEEK_API_KEY', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return Response.json({
        id: 'chatcmpl-deepseek',
        object: 'chat.completion',
        model: 'deepseek-v4-flash',
        usage: { prompt_tokens: 10, completion_tokens: 20 },
        choices: [{ index: 0, message: { role: 'assistant', content: 'hello' }, finish_reason: 'stop' }],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await callDeepSeek(createDeepSeekEnv(), {
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: 'test prompt' }],
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0];
    expect(input).toBe('https://api.deepseek.com/chat/completions');
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer test-deepseek-key');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('支持通过 DEEPSEEK_BASE_URL 覆盖接口基址', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await callDeepSeek(createDeepSeekEnv({ DEEPSEEK_BASE_URL: 'https://deepseek.example.test/v1' }), {
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: 'hello' }],
    });

    const [input] = fetchMock.mock.calls[0];
    expect(input).toBe('https://deepseek.example.test/v1/chat/completions');
  });

  it('缺少 DEEPSEEK_API_KEY 但包含 OPENCODE_GO_API_KEY 时自动降级接入 OpenCode Go', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await callDeepSeek(createOpenCodeGoEnv(), {
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0];
    expect(input).toBe('https://opencode.ai/zen/go/v1/chat/completions');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer test-opencode-go-key');
  });

  it('同时缺少 DEEPSEEK_API_KEY 和 OPENCODE_GO_API_KEY 时抛出包含两者的错误', async () => {
    await expect(
      callDeepSeek(createDeepSeekEnv({ DEEPSEEK_API_KEY: undefined }), {
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toThrow('缺少 DEEPSEEK_API_KEY 或 OPENCODE_GO_API_KEY');
  });

  it('正确传递 deepseek-v4.1-flash 请求体与多模态消息', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return Response.json({
        id: 'chatcmpl-deepseek-v4-1',
        object: 'chat.completion',
        model: 'deepseek-v4.1-flash',
        usage: { prompt_tokens: 15, completion_tokens: 30 },
        choices: [{ index: 0, message: { role: 'assistant', content: 'image received' }, finish_reason: 'stop' }],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await callDeepSeek(createDeepSeekEnv(), {
      model: 'deepseek-v4.1-flash',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'what is in this picture?' },
            { type: 'image_url', image_url: { url: 'https://example.com/test.png' } },
          ],
        },
      ],
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0];
    expect(input).toBe('https://api.deepseek.com/chat/completions');
    const sentBody = JSON.parse(init?.body as string);
    expect(sentBody.model).toBe('deepseek-v4.1-flash');
    expect(sentBody.messages[0].content).toHaveLength(2);
  });
});

describe('callOpenCodeGo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('直连 OpenCode Go API 端点并传递 OPENCODE_GO_API_KEY', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return Response.json({
        id: 'chatcmpl-opencode-go',
        object: 'chat.completion',
        model: 'deepseek-v4-flash',
        choices: [
          { index: 0, message: { role: 'assistant', content: 'hello from opencode go' }, finish_reason: 'stop' },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await callOpenCodeGo(createOpenCodeGoEnv(), {
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0];
    expect(input).toBe('https://opencode.ai/zen/go/v1/chat/completions');
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer test-opencode-go-key');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('x-opencode-session')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('优先透传已有 x-opencode-session 头部', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await callOpenCodeGo(
      createOpenCodeGoEnv(),
      { model: 'kimi-k3', messages: [{ role: 'user', content: 'hello' }] },
      { 'x-opencode-session': 'custom-session-uuid-1234' },
    );

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get('x-opencode-session')).toBe('custom-session-uuid-1234');
  });

  it('支持通过 OPENCODE_GO_BASE_URL 覆盖接口端点地址', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await callOpenCodeGo(createOpenCodeGoEnv({ OPENCODE_GO_BASE_URL: 'https://opencode.custom.test/v1' }), {
      model: 'kimi-k3',
      messages: [{ role: 'user', content: 'hello' }],
    });

    const [input] = fetchMock.mock.calls[0];
    expect(input).toBe('https://opencode.custom.test/v1/chat/completions');
  });

  it('缺少 OPENCODE_GO_API_KEY 时报错', async () => {
    await expect(
      callOpenCodeGo(createOpenCodeGoEnv({ OPENCODE_GO_API_KEY: undefined }), {
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toThrow('缺少 OPENCODE_GO_API_KEY');
  });
});

describe('resolveOpenCodeSession & generateSessionIdFromTrait', () => {
  it('同一特征生成稳定一致的 UUID', async () => {
    const session1 = await generateSessionIdFromTrait('user-123');
    const session2 = await generateSessionIdFromTrait('user-123');
    const session3 = await generateSessionIdFromTrait('user-456');

    expect(session1).toBe(session2);
    expect(session1).not.toBe(session3);
    expect(session1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('resolveOpenCodeSession 优先复用已有 header', async () => {
    const fromDirect = await resolveOpenCodeSession({ 'x-opencode-session': 'my-custom-uuid' });
    expect(fromDirect).toBe('my-custom-uuid');

    const fromAlias = await resolveOpenCodeSession({ 'x-session-id': 'alias-session-uuid' });
    expect(fromAlias).toBe('alias-session-uuid');
  });

  it('缺失 header 时由 userTrait 确定性派生', async () => {
    const resolved = await resolveOpenCodeSession(undefined, 'user-xyz');
    const expected = await generateSessionIdFromTrait('user-xyz');
    expect(resolved).toBe(expected);
  });
});

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
