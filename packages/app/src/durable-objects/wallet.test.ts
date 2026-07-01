import { describe, expect, it } from 'vitest';
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

  it('每次变更都会更新 KV 展示镜像', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedKvUser(kv, 'user-1', 10);

    await postJson<WalletResult>(durableObject, '/deduct', 'user-1', { amount: 4 });

    const mirrored = JSON.parse(kv.store.get('user:user-1')!.value);
    expect(mirrored.balance).toBe(6);
  });
});
