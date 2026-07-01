import { env, SELF } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ADMIN_SECRET = 'test-admin-secret';

function stubEmailFetch(): ReturnType<typeof vi.fn> {
  // 充值/告警流程会通过全局 fetch 调用 Resend 发邮件（已改为 waitUntil 异步）。
  // e2e 不应依赖外网/代理，也不应发真实邮件，故 stub 掉全局 fetch。
  const fetchMock = vi.fn(async () => Response.json({ id: 'test-email-id' }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

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
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('可以给用户充值（新用户，经 WalletDO 初始化）', async () => {
      // 注：vi.mock('resend') 在 workers 池里无法拦截被测 Worker 的模块图，stub 全局 fetch 才有效。
      const fetchMock = stubEmailFetch();

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
      const body = await res.json<{ isNewUser: boolean; balance: number }>();
      expect(body.isNewUser).toBe(true);
      expect(body.balance).toBe(5);
      // 等待 waitUntil 里的邮件发送命中 stub，确保在 unstub 前完成、不泄漏到真实网络
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    });

    it('二次充值走已有用户分支，余额通过 WalletDO 正确累加', async () => {
      stubEmailFetch();
      const email = 'repeat-recharge@example.com';

      const first = await SELF.fetch('http://localhost/admin/recharge', {
        method: 'POST',
        headers: { 'X-Admin-Secret': ADMIN_SECRET, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, amount: 10 }),
      });
      expect(first.status).toBe(200);

      const second = await SELF.fetch('http://localhost/admin/recharge', {
        method: 'POST',
        headers: { 'X-Admin-Secret': ADMIN_SECRET, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, amount: 7 }),
      });
      expect(second.status).toBe(200);
      const body = await second.json<{ isNewUser: boolean; balance: number }>();
      expect(body.isNewUser).toBe(false);
      expect(body.balance).toBe(17);
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
