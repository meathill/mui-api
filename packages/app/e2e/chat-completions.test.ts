import { SELF } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import { seedApiKey } from './helpers';

describe('POST /v1/chat/completions', () => {
  let apiKey: string;
  let brokeApiKey: string;

  beforeAll(async () => {
    apiKey = await seedApiKey('test-user-1');
    brokeApiKey = await seedApiKey('test-user-broke', 0);
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
});
