import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { seedApiKey } from './helpers';

/**
 * 回归测试：验证 WalletDO 修复了迁移前 KVService 读-改-写导致的并发扣费丢失问题
 * （ConcurrencyLimiterDO 允许每用户最多 maxConcurrency 个并发请求，旧实现下这是必现场景）。
 * 用真实 Miniflare DO 运行时（同一实例的调用天然串行）才能验证这个保证——纯 mock 的单测
 * 跑不出真正的并发语义，见 src/durable-objects/wallet.test.ts 里的逻辑覆盖。
 */
async function deduct(userId: string, amount: number): Promise<{ ok: boolean; data?: { balance: number } }> {
  const id = env.WALLET.idFromName(userId);
  const stub = env.WALLET.get(id);
  const response = await stub.fetch('https://wallet/deduct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ amount }),
  });
  return response.json();
}

describe('WalletDO 并发扣费', () => {
  it('N 个并发扣费请求全部生效，不丢更新', async () => {
    const userId = 'wallet-concurrency-user';
    await seedApiKey(userId, 100);

    const deductions = Array.from({ length: 10 }, () => 1);
    const results = await Promise.all(deductions.map((amount) => deduct(userId, amount)));

    expect(results.every((r) => r.ok)).toBe(true);

    const finalBalance = await deduct(userId, 0);
    const expected = 100 - deductions.reduce((sum, amount) => sum + amount, 0);
    expect(finalBalance.data?.balance).toBe(expected);

    const mirrored = await env.KV.get<{ balance: number }>(`user:${userId}`, 'json');
    expect(mirrored?.balance).toBe(expected);
  });

  it('并发预占不会超出余额，同一预占并发结算只扣一次', async () => {
    const userId = `wallet-reservation-${Date.now()}`;
    await seedApiKey(userId, 10);
    const stub = env.WALLET.get(env.WALLET.idFromName(userId));
    const reserve = (reservationId: string) =>
      stub.fetch('https://wallet/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ reservationId, amount: 2, expiresAt: Date.now() + 60_000 }),
      });

    const reservations = await Promise.all(Array.from({ length: 6 }, (_, index) => reserve(`video-${index}`)));
    expect(reservations.filter((response) => response.status === 200)).toHaveLength(5);
    expect(reservations.filter((response) => response.status === 402)).toHaveLength(1);

    const settle = () =>
      stub.fetch('https://wallet/settle-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ reservationId: 'video-0', amount: 2 }),
      });
    const settled = await Promise.all([settle(), settle()]);
    expect(settled.every((response) => response.ok)).toBe(true);
    expect((await env.KV.get<{ balance: number }>(`user:${userId}`, 'json'))?.balance).toBe(8);
  });
});
