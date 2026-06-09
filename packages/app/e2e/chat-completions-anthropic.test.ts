import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seedApiKey } from './helpers';

describe('POST /v1/chat/completions —— Claude 经 compat 端点（Unified Billing）', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('claude 走 compat 端点：仅 cf-aig-authorization、model 带 anthropic/ 前缀，按 OpenAI usage 扣费', async () => {
    const userId = `test-claude-compat-${Date.now()}`;
    const billKey = await seedApiKey(userId, 10);

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        id: 'chatcmpl-claude',
        object: 'chat.completion',
        created: 1,
        model: 'claude-sonnet-4-20250514',
        usage: { prompt_tokens: 100, completion_tokens: 50 },
        choices: [{ index: 0, message: { role: 'assistant', content: 'pong' }, finish_reason: 'stop' }],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await SELF.fetch('http://localhost/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${billKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });

    expect(res.status).toBe(200);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/compat/chat/completions');
    const h = new Headers(init?.headers);
    expect(h.get('cf-aig-authorization')).toBe('Bearer test-token');
    // compat 的 unified 代付绝不能带 Authorization，否则会被当作 Anthropic key（→401）
    expect(h.get('authorization')).toBeNull();
    const sentBody = JSON.parse(String(init?.body)) as { model: string };
    expect(sentBody.model).toBe('anthropic/claude-sonnet-4-20250514');

    // compat 返回 OpenAI 形 usage（prompt_tokens/completion_tokens），按 openai 解析后扣费
    await vi.waitFor(async () => {
      const userData = await env.KV.get<{ balance: number }>(`user:${userId}`, 'json');
      expect(userData?.balance).toBeLessThan(10);
    });
  });
});
