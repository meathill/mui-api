import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const ADMIN_SECRET = 'test-admin-secret';

describe('管理员接口', () => {
  describe('认证', () => {
    it('缺少 X-Admin-Secret 返回 401', async () => {
      const res = await SELF.fetch('http://localhost/admin/users');
      expect(res.status).toBe(401);
    });

    it('错误的 admin secret 返回 401', async () => {
      const res = await SELF.fetch('http://localhost/admin/users', {
        headers: { 'X-Admin-Secret': 'wrong-secret' },
      });
      expect(res.status).toBe(401);
    });
  });

  describe('用户管理', () => {
    it('正确 secret 可以获取用户列表', async () => {
      // users 路由的 GET / 挂载在 admin.route('/', users)
      const res = await SELF.fetch('http://localhost/admin', {
        headers: { 'X-Admin-Secret': ADMIN_SECRET },
      });
      expect(res.status).toBe(200);
    });
  });

  describe('模型管理', () => {
    it('可以获取模型列表', async () => {
      const res = await SELF.fetch('http://localhost/admin/models', {
        headers: { 'X-Admin-Secret': ADMIN_SECRET },
      });
      expect(res.status).toBe(200);
      const body = await res.json<{ models: Array<{ id: string }> }>();
      expect(body.models).toBeInstanceOf(Array);
    });

    it('可以添加新模型', async () => {
      const res = await SELF.fetch('http://localhost/admin/models', {
        method: 'POST',
        headers: {
          'X-Admin-Secret': ADMIN_SECRET,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: 'test-model-e2e',
          provider: 'openai',
          upstreamModelId: 'gpt-4o-mini',
          inputPrice: 0.00015,
          outputPrice: 0.0006,
          markupRate: 1.5,
        }),
      });
      expect(res.status).toBe(201);
    });
  });

  describe('充值', () => {
    it('可以给用户充值', async () => {
      const res = await SELF.fetch('http://localhost/admin/recharge', {
        method: 'POST',
        headers: {
          'X-Admin-Secret': ADMIN_SECRET,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          amount: 5,
        }),
      });
      expect(res.status).toBe(200);
    });
  });
});
