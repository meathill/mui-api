import { SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

describe('首页', () => {
  it('GET / 返回 200', async () => {
    const res = await SELF.fetch('http://localhost/');
    expect(res.status).toBe(200);
  });

  it('GET / 返回包含网关标题的 HTML', async () => {
    const res = await SELF.fetch('http://localhost/');
    const text = await res.text();
    expect(text).toContain('Uni-Gateway');
  });
});
