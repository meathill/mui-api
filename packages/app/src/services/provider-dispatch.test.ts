import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CloudflareBindings } from '../types';
import { callXiaomiMiMo } from './provider-dispatch';

function createEnv(overrides: Partial<CloudflareBindings> = {}): CloudflareBindings {
  return {
    MIMO_API_KEY: 'test-mimo-key',
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
