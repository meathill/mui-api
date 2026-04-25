import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('认证中间件', () => {
  it('缺少 Authorization header 返回 401', async () => {
    const res = await SELF.fetch('http://localhost/v1/models');
    expect(res.status).toBe(401);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('invalid_request_error');
  });

  it('无效的 key 格式返回 401', async () => {
    const res = await SELF.fetch('http://localhost/v1/models', {
      headers: { Authorization: 'Bearer invalid-key-format' },
    });
    expect(res.status).toBe(401);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('invalid_request_error');
  });

  it('不存在的 API key 返回 401', async () => {
    const res = await SELF.fetch('http://localhost/v1/models', {
      headers: { Authorization: 'Bearer sk-gw-nonexistent-key-12345' },
    });
    expect(res.status).toBe(401);
    const body = await res.json<{ error: { type: string } }>();
    expect(body.error.type).toBe('invalid_api_key');
  });
});
