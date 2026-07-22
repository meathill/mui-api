import { describe, expect, it, vi } from 'vitest';
import { WalletDO } from './wallet';

interface StoredValue {
  value: string;
  metadata?: unknown;
}

function createMockKV() {
  const store = new Map<string, StoredValue>();

  return {
    async getWithMetadata<TValue, TMetadata>(key: string, type?: string) {
      const item = store.get(key);
      if (!item) {
        return { value: null, metadata: null };
      }
      return {
        value: (type === 'json' ? JSON.parse(item.value) : item.value) as TValue,
        metadata: (item.metadata ?? null) as TMetadata | null,
      };
    },
    async put(key: string, value: string, options?: { metadata?: unknown }) {
      store.set(key, { value, metadata: options?.metadata });
    },
    store,
  };
}

function createMockStorage() {
  const store = new Map<string, unknown>();

  return {
    async get<T>(key: string): Promise<T | undefined> {
      return store.get(key) as T | undefined;
    },
    async put<T>(keyOrEntries: string | Record<string, T>, value?: T): Promise<void> {
      if (typeof keyOrEntries === 'string') {
        store.set(keyOrEntries, value);
        return;
      }
      for (const [key, item] of Object.entries(keyOrEntries)) {
        store.set(key, item);
      }
    },
    async list<T>(options?: { prefix?: string }): Promise<Map<string, T>> {
      return new Map(
        Array.from(store.entries()).filter(([key]) => !options?.prefix || key.startsWith(options.prefix)),
      ) as Map<string, T>;
    },
    async delete(keys: string | string[]): Promise<boolean | number> {
      if (Array.isArray(keys)) {
        let count = 0;
        for (const key of keys) count += store.delete(key) ? 1 : 0;
        return count;
      }
      return store.delete(keys);
    },
    store,
  };
}

function createDurableObject() {
  const kv = createMockKV();
  const storage = createMockStorage();

  const durableObject = new WalletDO(
    {
      storage: storage as unknown as DurableObjectStorage,
      // 单测里 fetch() 调用天然顺序执行，不需要真的加锁；真正的并发串行化由
      // e2e/wallet-concurrency.test.ts 用真实 Miniflare DO 运行时验证。
      blockConcurrencyWhile: async <T>(fn: () => Promise<T>) => fn(),
    } as unknown as DurableObjectState,
    { KV: kv } as unknown as import('../types').CloudflareBindings,
  );

  return { durableObject, kv, storage };
}

async function seedKvUser(kv: ReturnType<typeof createMockKV>, userId: string, balance: number): Promise<void> {
  await kv.put(`user:${userId}`, JSON.stringify({ balance, concurrency: 0, isSuspended: false }), {
    metadata: { email: `${userId}@test.com`, createdAt: '2026-04-19T00:00:00.000Z' },
  });
}

async function postJson<T>(durableObject: WalletDO, path: string, userId: string, body: unknown): Promise<T> {
  const response = await durableObject.fetch(
    new Request(`https://wallet${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify(body),
    }),
  );
  return (await response.json()) as T;
}

interface WalletResult {
  ok: boolean;
  error?: string;
  data?: { balance: number; concurrency: number; freeQuotaUsed?: number; isSuspended?: boolean };
  metadata?: { maxConcurrency?: number; rateMultiplier?: number; email: string; createdAt: string };
  reservation?: {
    reservationId: string;
    amount: number;
    status: 'reserved' | 'settled' | 'released';
    expiresAt: number;
    settledAmount?: number;
  };
}

describe('WalletDO', () => {
  it('/create 初始化新用户，并写入 KV 镜像', async () => {
    const { durableObject, kv } = createDurableObject();

    const result = await postJson<WalletResult>(durableObject, '/create', 'user-1', {
      email: 'user-1@test.com',
      initialBalance: 10,
    });

    expect(result.ok).toBe(true);
    expect(result.data?.balance).toBe(10);
    expect(kv.store.has('user:user-1')).toBe(true);
    expect(JSON.parse(kv.store.get('user:user-1')!.value).balance).toBe(10);
  });

  it('/create 幂等：已存在时不重置余额', async () => {
    const { durableObject } = createDurableObject();

    await postJson<WalletResult>(durableObject, '/create', 'user-1', { email: 'user-1@test.com', initialBalance: 10 });
    await postJson<WalletResult>(durableObject, '/deduct', 'user-1', { amount: 3 });
    const second = await postJson<WalletResult>(durableObject, '/create', 'user-1', {
      email: 'user-1@test.com',
      initialBalance: 999,
    });

    expect(second.data?.balance).toBe(7);
  });

  it('/deduct 首次触达时从 KV 镜像自愈迁移', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedKvUser(kv, 'user-1', 10);

    const result = await postJson<WalletResult>(durableObject, '/deduct', 'user-1', { amount: 4 });

    expect(result.data?.balance).toBe(6);
  });

  it('/deduct 下限为 0，不会扣成负数', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedKvUser(kv, 'user-1', 5);

    const result = await postJson<WalletResult>(durableObject, '/deduct', 'user-1', { amount: 10 });

    expect(result.data?.balance).toBe(0);
  });

  it('/deduct 对完全不存在的用户返回 404', async () => {
    const { durableObject } = createDurableObject();

    const response = await durableObject.fetch(
      new Request('https://wallet/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'ghost' },
        body: JSON.stringify({ amount: 1 }),
      }),
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as WalletResult;
    expect(body.error).toBe('user_not_found');
  });

  it('/add 增加余额', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedKvUser(kv, 'user-1', 10);

    const result = await postJson<WalletResult>(durableObject, '/add', 'user-1', { amount: 20 });

    expect(result.data?.balance).toBe(30);
  });

  it('/consume-free-quota 累加已使用额度', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedKvUser(kv, 'user-1', 10);

    const first = await postJson<WalletResult>(durableObject, '/consume-free-quota', 'user-1', { amount: 0.5 });
    const second = await postJson<WalletResult>(durableObject, '/consume-free-quota', 'user-1', { amount: 0.25 });

    expect(first.data?.freeQuotaUsed).toBe(0.5);
    expect(second.data?.freeQuotaUsed).toBe(0.75);
  });

  it('/suspend 与 /unsuspend 切换暂停状态', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedKvUser(kv, 'user-1', 10);

    const suspended = await postJson<WalletResult>(durableObject, '/suspend', 'user-1', {});
    expect(suspended.data?.isSuspended).toBe(true);

    const unsuspended = await postJson<WalletResult>(durableObject, '/unsuspend', 'user-1', {});
    expect(unsuspended.data?.isSuspended).toBe(false);
  });

  it('/set-metadata 只合并传入的字段，不覆盖其它字段', async () => {
    const { durableObject } = createDurableObject();
    await postJson<WalletResult>(durableObject, '/create', 'user-1', { email: 'user-1@test.com', initialBalance: 0 });

    const afterMaxConcurrency = await postJson<WalletResult>(durableObject, '/set-metadata', 'user-1', {
      maxConcurrency: 5,
    });
    expect(afterMaxConcurrency.metadata?.maxConcurrency).toBe(5);
    expect(afterMaxConcurrency.metadata?.email).toBe('user-1@test.com');

    const afterRateMultiplier = await postJson<WalletResult>(durableObject, '/set-metadata', 'user-1', {
      rateMultiplier: 1.5,
    });
    expect(afterRateMultiplier.metadata?.rateMultiplier).toBe(1.5);
    // 之前设置的 maxConcurrency 应该被保留，不因这次只传 rateMultiplier 而丢失
    expect(afterRateMultiplier.metadata?.maxConcurrency).toBe(5);
  });

  it('/set-concurrency 只更新并发数，不动余额，并刷新镜像', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedKvUser(kv, 'user-1', 10);

    const result = await postJson<WalletResult>(durableObject, '/set-concurrency', 'user-1', { concurrency: 3 });

    expect(result.ok).toBe(true);
    expect(result.data?.concurrency).toBe(3);
    expect(result.data?.balance).toBe(10);
    const mirrored = JSON.parse(kv.store.get('user:user-1')!.value);
    expect(mirrored.concurrency).toBe(3);
    expect(mirrored.balance).toBe(10);
  });

  it('/set-concurrency 数值未变化时跳过镜像写入，负数收敛为 0', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedKvUser(kv, 'user-1', 10);
    await postJson<WalletResult>(durableObject, '/set-concurrency', 'user-1', { concurrency: 2 });

    const putSpy = vi.spyOn(kv, 'put');
    const repeated = await postJson<WalletResult>(durableObject, '/set-concurrency', 'user-1', { concurrency: 2 });
    expect(repeated.ok).toBe(true);
    expect(putSpy).not.toHaveBeenCalled();

    const negative = await postJson<WalletResult>(durableObject, '/set-concurrency', 'user-1', { concurrency: -5 });
    expect(negative.data?.concurrency).toBe(0);
  });

  it('/set-concurrency 对不存在的用户返回 404', async () => {
    const { durableObject } = createDurableObject();

    const response = await durableObject.fetch(
      new Request('https://wallet/set-concurrency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'ghost' },
        body: JSON.stringify({ concurrency: 1 }),
      }),
    );

    expect(response.status).toBe(404);
  });

  it('每次变更都会更新 KV 展示镜像', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedKvUser(kv, 'user-1', 10);

    await postJson<WalletResult>(durableObject, '/deduct', 'user-1', { amount: 4 });

    const mirrored = JSON.parse(kv.store.get('user:user-1')!.value);
    expect(mirrored.balance).toBe(6);
  });

  it('/sync-mirror 用权威账本重写脏 KV 镜像', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedKvUser(kv, 'user-1', 26.44);
    // 先触达一次让 storage 完成自愈迁移（账本 = 26.44）
    await postJson<WalletResult>(durableObject, '/add', 'user-1', { amount: 0 });

    // 模拟镜像被旁路写脏
    await kv.put('user:user-1', JSON.stringify({ balance: 6.44, concurrency: 0 }), {
      metadata: { email: 'user-1@test.com', createdAt: '2026-04-19T00:00:00.000Z' },
    });

    const result = await postJson<WalletResult>(durableObject, '/sync-mirror', 'user-1', {});

    expect(result.ok).toBe(true);
    expect(result.data?.balance).toBe(26.44);
    expect(JSON.parse(kv.store.get('user:user-1')!.value).balance).toBe(26.44);
  });

  it('/sync-mirror 对不存在的用户返回 404', async () => {
    const { durableObject } = createDurableObject();

    const response = await durableObject.fetch(
      new Request('https://wallet/sync-mirror', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'ghost' },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(404);
  });

  it('镜像写并发时 single-flight 串行落地，终值等于权威账本', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedKvUser(kv, 'user-1', 10);
    await postJson<WalletResult>(durableObject, '/add', 'user-1', { amount: 0 });

    // 让第一次镜像 put 挂起：旧实现里后发先至的 put 会把旧余额留在 KV
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const originalPut = kv.put.bind(kv);
    let shouldDelay = true;
    vi.spyOn(kv, 'put').mockImplementation(async (key: string, value: string, options?: { metadata?: unknown }) => {
      if (shouldDelay) {
        shouldDelay = false;
        await gate;
      }
      return originalPut(key, value, options);
    });

    const first = postJson<WalletResult>(durableObject, '/deduct', 'user-1', { amount: 1 });
    const second = postJson<WalletResult>(durableObject, '/deduct', 'user-1', { amount: 2 });
    release();
    await Promise.all([first, second]);

    expect(JSON.parse(kv.store.get('user:user-1')!.value).balance).toBe(7);
  });

  it('预占会扣减可用余额，但只在结算时修改实际余额', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedKvUser(kv, 'user-1', 10);

    const first = await postJson<WalletResult>(durableObject, '/reserve', 'user-1', {
      reservationId: 'video-1',
      amount: 6,
      expiresAt: Date.now() + 60_000,
    });
    expect(first.reservation?.status).toBe('reserved');
    expect(JSON.parse(kv.store.get('user:user-1')!.value).balance).toBe(10);

    const deniedResponse = await durableObject.fetch(
      new Request('https://wallet/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'user-1' },
        body: JSON.stringify({ reservationId: 'video-2', amount: 5, expiresAt: Date.now() + 60_000 }),
      }),
    );
    expect(deniedResponse.status).toBe(402);

    const settled = await postJson<WalletResult>(durableObject, '/settle-reservation', 'user-1', {
      reservationId: 'video-1',
      amount: 4,
    });
    expect(settled.reservation?.settledAmount).toBe(4);
    expect(settled.data?.balance).toBe(6);

    const repeated = await postJson<WalletResult>(durableObject, '/settle-reservation', 'user-1', {
      reservationId: 'video-1',
      amount: 6,
    });
    expect(repeated.data?.balance).toBe(6);
  });

  it('释放预占幂等，释放后额度可再次预占', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedKvUser(kv, 'user-1', 5);
    await postJson<WalletResult>(durableObject, '/reserve', 'user-1', {
      reservationId: 'video-1',
      amount: 5,
      expiresAt: Date.now() + 60_000,
    });
    const released = await postJson<WalletResult>(durableObject, '/release-reservation', 'user-1', {
      reservationId: 'video-1',
    });
    expect(released.reservation?.status).toBe('released');
    const repeated = await postJson<WalletResult>(durableObject, '/release-reservation', 'user-1', {
      reservationId: 'video-1',
    });
    expect(repeated.reservation?.status).toBe('released');
    const next = await postJson<WalletResult>(durableObject, '/reserve', 'user-1', {
      reservationId: 'video-2',
      amount: 5,
      expiresAt: Date.now() + 60_000,
    });
    expect(next.reservation?.status).toBe('reserved');
  });

  it('/refresh-reservation 延长 reserved 状态预占的到期时间', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedKvUser(kv, 'user-1', 10);
    const firstExpiresAt = Date.now() + 60_000;
    await postJson<WalletResult>(durableObject, '/reserve', 'user-1', {
      reservationId: 'video-1',
      amount: 5,
      expiresAt: firstExpiresAt,
    });

    const refreshedExpiresAt = firstExpiresAt + 60_000;
    const refreshed = await postJson<WalletResult>(durableObject, '/refresh-reservation', 'user-1', {
      reservationId: 'video-1',
      expiresAt: refreshedExpiresAt,
    });

    expect(refreshed.ok).toBe(true);
    expect(refreshed.reservation?.status).toBe('reserved');
    expect(refreshed.reservation?.expiresAt).toBe(refreshedExpiresAt);
  });

  it('/refresh-reservation 对已结算的预占是无操作，不更新到期时间', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedKvUser(kv, 'user-1', 10);
    const firstExpiresAt = Date.now() + 60_000;
    await postJson<WalletResult>(durableObject, '/reserve', 'user-1', {
      reservationId: 'video-1',
      amount: 5,
      expiresAt: firstExpiresAt,
    });
    await postJson<WalletResult>(durableObject, '/settle-reservation', 'user-1', {
      reservationId: 'video-1',
      amount: 5,
    });

    const refreshed = await postJson<WalletResult>(durableObject, '/refresh-reservation', 'user-1', {
      reservationId: 'video-1',
      expiresAt: firstExpiresAt + 60_000,
    });

    expect(refreshed.ok).toBe(true);
    expect(refreshed.reservation?.status).toBe('settled');
    expect(refreshed.reservation?.expiresAt).toBe(firstExpiresAt);
  });

  it('/refresh-reservation 对已释放的预占是无操作，不更新到期时间', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedKvUser(kv, 'user-1', 10);
    const firstExpiresAt = Date.now() + 60_000;
    await postJson<WalletResult>(durableObject, '/reserve', 'user-1', {
      reservationId: 'video-1',
      amount: 5,
      expiresAt: firstExpiresAt,
    });
    await postJson<WalletResult>(durableObject, '/release-reservation', 'user-1', {
      reservationId: 'video-1',
    });

    const refreshed = await postJson<WalletResult>(durableObject, '/refresh-reservation', 'user-1', {
      reservationId: 'video-1',
      expiresAt: firstExpiresAt + 60_000,
    });

    expect(refreshed.ok).toBe(true);
    expect(refreshed.reservation?.status).toBe('released');
    expect(refreshed.reservation?.expiresAt).toBe(firstExpiresAt);
  });

  it('/refresh-reservation 对不存在的预占返回 404', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedKvUser(kv, 'user-1', 10);

    const response = await durableObject.fetch(
      new Request('https://wallet/refresh-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'user-1' },
        body: JSON.stringify({ reservationId: 'ghost', expiresAt: Date.now() + 60_000 }),
      }),
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as WalletResult;
    expect(body.error).toBe('reservation_not_found');
  });

  it('/refresh-reservation 缺少 reservationId 或 expiresAt 非法时返回 400', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedKvUser(kv, 'user-1', 10);

    const missingId = await durableObject.fetch(
      new Request('https://wallet/refresh-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'user-1' },
        body: JSON.stringify({ expiresAt: Date.now() + 60_000 }),
      }),
    );
    expect(missingId.status).toBe(400);
    expect(((await missingId.json()) as WalletResult).error).toBe('invalid_reservation');

    const invalidExpiresAt = await durableObject.fetch(
      new Request('https://wallet/refresh-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': 'user-1' },
        body: JSON.stringify({ reservationId: 'video-1', expiresAt: Number.NaN }),
      }),
    );
    expect(invalidExpiresAt.status).toBe(400);
    expect(((await invalidExpiresAt.json()) as WalletResult).error).toBe('invalid_reservation');
  });
});
