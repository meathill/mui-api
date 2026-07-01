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
});
