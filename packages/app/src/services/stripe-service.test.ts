import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rechargeLogs, stripeTopupSessions, wallets } from '../db';
import type { CloudflareBindings } from '../types';
import { createTopupSession, handleStripeWebhook } from './stripe-service';

const { sessionsCreate, constructEvent } = vi.hoisted(() => ({
  sessionsCreate: vi.fn(),
  constructEvent: vi.fn(),
}));

vi.mock('stripe', () => {
  const StripeMock = vi.fn(function StripeCtor() {
    return {
      checkout: { sessions: { create: sessionsCreate } },
      webhooks: { constructEventAsync: constructEvent },
    };
  }) as unknown as { new (): unknown; createFetchHttpClient: () => unknown };
  StripeMock.createFetchHttpClient = vi.fn(() => ({}));
  return { default: StripeMock };
});

function makeEnv(overrides: Record<string, unknown> = {}): CloudflareBindings {
  return {
    STRIPE_SECRET_KEY: 'sk_test',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    BASE_URL: 'https://app',
    KV: { getWithMetadata: async () => ({ value: null, metadata: null }) },
    ...overrides,
  } as unknown as CloudflareBindings;
}

function makeDb(opts: { existingSession?: unknown; walletUpdateReturning?: Array<{ balance: number }> } = {}) {
  const walletUpdateReturning = opts.walletUpdateReturning ?? [{ balance: 30 }];
  const spies = {
    findFirst: vi.fn(async () => opts.existingSession),
    walletUpdateSet: vi.fn<(v: unknown) => void>(),
    walletInsert: vi.fn<(v: unknown) => void>(),
    rechargeInsert: vi.fn<(v: unknown) => void>(),
    sessionUpdateSet: vi.fn<(v: unknown) => void>(),
    sessionInsert: vi.fn<(v: unknown) => void>(),
  };
  const db = {
    query: { stripeTopupSessions: { findFirst: spies.findFirst } },
    update(table: unknown) {
      return {
        set(vals: unknown) {
          if (table === wallets) {
            spies.walletUpdateSet(vals);
            return { where: () => ({ returning: async () => walletUpdateReturning }) };
          }
          spies.sessionUpdateSet(vals);
          return { where: async () => undefined };
        },
      };
    },
    insert(table: unknown) {
      return {
        values: async (v: unknown) => {
          if (table === wallets) spies.walletInsert(v);
          else if (table === rechargeLogs) spies.rechargeInsert(v);
          else if (table === stripeTopupSessions) spies.sessionInsert(v);
        },
      };
    },
  };
  // biome-ignore lint/suspicious/noExplicitAny: 测试用最小 mock，无需完整 Database 类型
  return { db: db as any, spies };
}

function checkoutEvent(objectOverrides: Record<string, unknown> = {}) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_1',
        metadata: { userId: 'u1' },
        client_reference_id: 'u1',
        currency: 'usd',
        amount_total: 1000,
        payment_status: 'paid',
        payment_intent: 'pi_1',
        customer: 'cus_1',
        ...objectOverrides,
      },
    },
  };
}

beforeEach(() => {
  sessionsCreate.mockReset();
  constructEvent.mockReset();
  constructEvent.mockResolvedValue(checkoutEvent());
});

describe('handleStripeWebhook 校验与分支', () => {
  it('未配置 webhook secret 返回 503', async () => {
    const { db } = makeDb();
    const res = await handleStripeWebhook(makeEnv({ STRIPE_WEBHOOK_SECRET: undefined }), db, 'body', 'sig');
    expect(res.status).toBe(503);
    expect(res.body.received).toBe(false);
  });

  it('缺少签名返回 400', async () => {
    const { db } = makeDb();
    const res = await handleStripeWebhook(makeEnv(), db, 'body', undefined);
    expect(res.status).toBe(400);
  });

  it('签名校验失败返回 400', async () => {
    constructEvent.mockRejectedValue(new Error('bad sig'));
    const { db } = makeDb();
    const res = await handleStripeWebhook(makeEnv(), db, 'body', 'sig');
    expect(res.status).toBe(400);
    expect(res.body.reason).toContain('签名校验失败');
  });

  it('非 checkout.session.completed 事件不处理', async () => {
    constructEvent.mockResolvedValue({ type: 'payment_intent.succeeded', data: { object: {} } });
    const { db, spies } = makeDb();
    const res = await handleStripeWebhook(makeEnv(), db, 'body', 'sig');
    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(false);
    expect(spies.rechargeInsert).not.toHaveBeenCalled();
  });

  it('会话缺少 userId 不入账', async () => {
    constructEvent.mockResolvedValue(checkoutEvent({ metadata: {}, client_reference_id: null }));
    const { db, spies } = makeDb();
    const res = await handleStripeWebhook(makeEnv(), db, 'body', 'sig');
    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(false);
    expect(spies.rechargeInsert).not.toHaveBeenCalled();
  });

  it('幂等：已 completed 的 session 跳过', async () => {
    const { db, spies } = makeDb({ existingSession: { status: 'completed' } });
    const res = await handleStripeWebhook(makeEnv(), db, 'body', 'sig');
    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(false);
    expect(res.body.reason).toBe('已处理');
    expect(spies.walletUpdateSet).not.toHaveBeenCalled();
  });

  it('amount=0 不入账', async () => {
    constructEvent.mockResolvedValue(checkoutEvent({ amount_total: 0 }));
    const { db, spies } = makeDb();
    const res = await handleStripeWebhook(makeEnv(), db, 'body', 'sig');
    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(false);
    expect(spies.rechargeInsert).not.toHaveBeenCalled();
  });

  it('happy path：累加钱包 + 写 recharge_logs + 标记 session', async () => {
    const { db, spies } = makeDb({ walletUpdateReturning: [{ balance: 30 }] });
    const res = await handleStripeWebhook(makeEnv(), db, 'body', 'sig');
    expect(res.status).toBe(200);
    expect(res.body.processed).toBe(true);
    expect(spies.walletUpdateSet).toHaveBeenCalledTimes(1);
    expect(spies.rechargeInsert).toHaveBeenCalledTimes(1);
    expect(spies.rechargeInsert.mock.calls[0][0]).toMatchObject({ userId: 'u1', amount: 10, source: 'stripe' });
    expect(spies.sessionUpdateSet.mock.calls[0][0]).toMatchObject({ status: 'completed', balanceAfter: 30 });
  });
});

describe('createTopupSession', () => {
  it('创建 Checkout Session 并落库', async () => {
    sessionsCreate.mockResolvedValue({ id: 'cs_new', url: 'https://co' });
    const { db, spies } = makeDb();
    const result = await createTopupSession(makeEnv(), db, { userId: 'u1', amountCents: 1500, currency: 'usd' });
    expect(result).toEqual({ url: 'https://co', session_id: 'cs_new', amount_cents: 1500, currency: 'USD' });
    expect(sessionsCreate.mock.calls[0][0]).toMatchObject({
      mode: 'payment',
      metadata: { userId: 'u1' },
      line_items: [{ price_data: { unit_amount: 1500 } }],
    });
    expect(spies.sessionInsert.mock.calls[0][0]).toMatchObject({
      checkoutSessionId: 'cs_new',
      userId: 'u1',
      amount: 15,
      status: 'created',
    });
  });

  it('未配置 STRIPE_SECRET_KEY 抛错', async () => {
    const { db } = makeDb();
    await expect(
      createTopupSession(makeEnv({ STRIPE_SECRET_KEY: undefined }), db, {
        userId: 'u1',
        amountCents: 1000,
        currency: 'usd',
      }),
    ).rejects.toThrow('STRIPE_SECRET_KEY');
  });
});
