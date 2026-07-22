import { env, SELF } from 'cloudflare:test';
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

  describe('钱包镜像同步', () => {
    it('sync-wallet-mirror 用权威账本重写被写脏的 KV 镜像', async () => {
      const userId = 'admin-sync-mirror-user';
      // 先经 KV 播种并触达 WalletDO，让权威 storage 完成自愈迁移（账本 = 26.44）
      await env.KV.put(`user:${userId}`, JSON.stringify({ balance: 26.44, concurrency: 0 }), {
        metadata: { email: `${userId}@test.com`, createdAt: new Date().toISOString() },
      });
      const stub = env.WALLET.get(env.WALLET.idFromName(userId));
      await stub.fetch('https://wallet/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ amount: 0 }),
      });

      // 模拟镜像被旁路写脏（2026-07-21 事故现场）
      await env.KV.put(`user:${userId}`, JSON.stringify({ balance: 6.44, concurrency: 0 }), {
        metadata: { email: `${userId}@test.com`, createdAt: new Date().toISOString() },
      });

      const res = await SELF.fetch('http://localhost/admin/sync-wallet-mirror', {
        method: 'POST',
        headers: { 'X-Admin-Secret': ADMIN_SECRET, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      expect(res.status).toBe(200);
      const body = await res.json<{ success: boolean; balance: number }>();
      expect(body.success).toBe(true);
      expect(body.balance).toBe(26.44);
      const mirrored = await env.KV.get<{ balance: number }>(`user:${userId}`, 'json');
      expect(mirrored?.balance).toBe(26.44);
    });

    it('sync-wallet-mirror 对不存在的用户返回 404', async () => {
      const res = await SELF.fetch('http://localhost/admin/sync-wallet-mirror', {
        method: 'POST',
        headers: { 'X-Admin-Secret': ADMIN_SECRET, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ghost-no-such-user@example.com' }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe('账户暂停/恢复', () => {
    it('可以解除用户暂停', async () => {
      const userId = 'admin-unsuspend-user';
      await env.KV.put(`user:${userId}`, JSON.stringify({ balance: 10, concurrency: 0, isSuspended: true }), {
        metadata: { email: `${userId}@test.com`, createdAt: new Date().toISOString() },
      });

      const res = await SELF.fetch('http://localhost/admin/unsuspend-user', {
        method: 'POST',
        headers: { 'X-Admin-Secret': ADMIN_SECRET, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      expect(res.status).toBe(200);
      const mirrored = await env.KV.get<{ isSuspended: boolean }>(`user:${userId}`, 'json');
      expect(mirrored?.isSuspended).toBe(false);
    });
  });
});
