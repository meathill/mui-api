import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../src/db';
import { rechargeLogs, usageLogs, users } from '../src/db/schema';
import { getBalanceSnapshot, listRecharges, listUsage } from '../src/services/wallet-query-service';

/**
 * wallet-query-service E2E：真实 D1。重点验证游标分页（limit+1 探测、next_cursor 翻页）、
 * 过滤条件、以及余额快照「余额只来自 KV 镜像」的口径。
 */

const db = createDb(env.DB);
const USER_ID = 'wallet-u1';
const now = Date.now();
const T30 = new Date(now - 30 * 60_000); // 最旧
const T20 = new Date(now - 20 * 60_000);
const T10 = new Date(now - 10 * 60_000); // 最新

beforeAll(async () => {
  await db.insert(users).values({
    id: USER_ID,
    name: 'wallet',
    email: 'wallet-u1@example.com',
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(rechargeLogs).values([
    { id: 'wr-1', userId: USER_ID, amount: 10, source: 'admin', createdAt: T30 },
    { id: 'wr-2', userId: USER_ID, amount: 20, source: 'stripe', createdAt: T10 },
  ]);

  await db.insert(usageLogs).values([
    { id: 'wu-A', userId: USER_ID, modelId: 'gpt-4o', inputTokens: 100, outputTokens: 50, cost: 0.5, createdAt: T30 },
    { id: 'wu-B', userId: USER_ID, modelId: 'gpt-4o', inputTokens: 200, outputTokens: 80, cost: 1.0, createdAt: T20 },
    {
      id: 'wu-C',
      userId: USER_ID,
      modelId: 'claude-sonnet-4-20250514',
      inputTokens: 300,
      outputTokens: 120,
      cost: 0.25,
      createdAt: T10,
    },
  ]);
});

describe('getBalanceSnapshot', () => {
  it('无 KV 记录时余额为 0，lifetime 按 logs 聚合', async () => {
    const snap = await getBalanceSnapshot(db, USER_ID);
    expect(snap.currency).toBe('USD');
    expect(snap.balance_cents).toBe(0);
    expect(snap.lifetime_topped_up_cents).toBe(3000); // 10 + 20
    expect(snap.lifetime_spent_cents).toBe(175); // 0.5 + 1.0 + 0.25
  });

  it('有 KV 用户时余额以 KV 为准', async () => {
    await env.KV.put(`user:${USER_ID}`, JSON.stringify({ balance: 99, concurrency: 0 }), {
      metadata: { email: 'wallet-u1@example.com', createdAt: new Date().toISOString() },
    });
    const snap = await getBalanceSnapshot(db, USER_ID, env.KV);
    expect(snap.balance_cents).toBe(9900);
  });
});

describe('listUsage 游标分页', () => {
  it('limit=2 翻页覆盖全部 3 条，顺序按时间倒序', async () => {
    const page1 = await listUsage(db, USER_ID, { limit: '2' });
    expect(page1.items.map((i) => i.id)).toEqual(['wu-C', 'wu-B']);
    expect(page1.next_cursor).toBeTruthy();

    const page2 = await listUsage(db, USER_ID, { limit: '2', cursor: page1.next_cursor ?? undefined });
    expect(page2.items.map((i) => i.id)).toEqual(['wu-A']);
    expect(page2.next_cursor).toBeNull();
  });

  it('cost_cents 正确换算', async () => {
    const page = await listUsage(db, USER_ID, { limit: '1' });
    expect(page.items[0]).toMatchObject({ id: 'wu-C', model_id: 'claude-sonnet-4-20250514', cost_cents: 25 });
  });

  it('model 过滤只返回匹配模型', async () => {
    const result = await listUsage(db, USER_ID, { model: 'gpt-4o' });
    expect(result.items.map((i) => i.id)).toEqual(['wu-B', 'wu-A']);
  });

  it('from 过滤按时间下界裁剪', async () => {
    const from = new Date(now - 15 * 60_000).toISOString();
    const result = await listUsage(db, USER_ID, { from });
    expect(result.items.map((i) => i.id)).toEqual(['wu-C']);
  });
});

describe('listRecharges 游标分页', () => {
  it('limit=1 翻页覆盖全部 2 条', async () => {
    const page1 = await listRecharges(db, USER_ID, { limit: '1' });
    expect(page1.items.map((i) => i.id)).toEqual(['wr-2']);
    expect(page1.items[0]).toMatchObject({ amount: 20, amount_cents: 2000, source: 'stripe' });
    expect(page1.next_cursor).toBeTruthy();

    const page2 = await listRecharges(db, USER_ID, { limit: '1', cursor: page1.next_cursor ?? undefined });
    expect(page2.items.map((i) => i.id)).toEqual(['wr-1']);
    expect(page2.next_cursor).toBeNull();
  });
});
