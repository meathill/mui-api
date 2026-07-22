import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConcurrencyLimiterDO } from './concurrency-limiter';
import { WalletDO } from './wallet';

interface StoredValue {
  value: string;
  metadata?: unknown;
}

function createMockKV() {
  const store = new Map<string, StoredValue>();

  return {
    store,
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
  };
}

function createMockStorage() {
  const store = new Map<string, unknown>();
  let alarm: number | null = null;

  return {
    async get<T>(key: string): Promise<T | undefined> {
      return store.get(key) as T | undefined;
    },
    async list<T>(options?: { prefix?: string }): Promise<Map<string, T>> {
      const entries = new Map<string, T>();
      for (const [key, value] of store.entries()) {
        if (!options?.prefix || key.startsWith(options.prefix)) {
          entries.set(key, value as T);
        }
      }
      return entries;
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
    async delete(keyOrKeys: string | string[]): Promise<boolean | number> {
      if (typeof keyOrKeys === 'string') {
        return store.delete(keyOrKeys);
      }

      let deleted = 0;
      for (const key of keyOrKeys) {
        if (store.delete(key)) {
          deleted++;
        }
      }
      return deleted;
    },
    async setAlarm(value: number | Date): Promise<void> {
      alarm = typeof value === 'number' ? value : value.getTime();
    },
    async deleteAlarm(): Promise<void> {
      alarm = null;
    },
    async getAlarm(): Promise<number | null> {
      return alarm;
    },
    store,
  };
}

function createDurableObject() {
  const kv = createMockKV();
  const storage = createMockStorage();

  // 真实 WalletDO 接入 WALLET 绑定：镜像同步统一走 /set-concurrency，
  // KV 里的镜像由 WalletDO 从自己的权威 storage 写出。
  const walletStorage = createMockStorage();
  const walletDO = new WalletDO(
    {
      storage: walletStorage as unknown as DurableObjectStorage,
      blockConcurrencyWhile: async <T>(fn: () => Promise<T>) => fn(),
    } as unknown as DurableObjectState,
    { KV: kv } as unknown as import('../types').CloudflareBindings,
  );

  // 限流器自己的 env.KV 用探针替代：改造后它不应再直接读写 KV
  const limiterKvCalls: string[] = [];
  const limiterKvProbe = {
    async getWithMetadata() {
      limiterKvCalls.push('getWithMetadata');
      return { value: null, metadata: null };
    },
    async put() {
      limiterKvCalls.push('put');
    },
  };

  const durableObject = new ConcurrencyLimiterDO(
    {
      storage: storage as unknown as DurableObjectStorage,
    } as DurableObjectState,
    {
      KV: limiterKvProbe,
      WALLET: {
        idFromName: (name: string) => name,
        get: () => ({
          fetch: (url: string, init?: RequestInit) => walletDO.fetch(new Request(url, init)),
        }),
      },
    } as unknown as import('../types').CloudflareBindings,
  );

  return { durableObject, kv, storage, walletDO, walletStorage, limiterKvCalls };
}

async function seedUser(kv: ReturnType<typeof createMockKV>, userId: string): Promise<void> {
  await kv.put(
    `user:${userId}`,
    JSON.stringify({
      balance: 10,
      concurrency: 0,
      isSuspended: false,
    }),
    {
      metadata: {
        email: `${userId}@test.com`,
        createdAt: '2026-04-19T00:00:00.000Z',
        maxConcurrency: 2,
      },
    },
  );
}

async function postJson<T>(
  durableObject: ConcurrencyLimiterDO | WalletDO,
  path: string,
  userId: string,
  body: unknown,
): Promise<T> {
  const response = await durableObject.fetch(
    new Request(`https://concurrency${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify(body),
    }),
  );

  return (await response.json()) as T;
}

describe('ConcurrencyLimiterDO', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-19T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('未超限时可以获取 lease 并同步镜像', async () => {
    const { durableObject, kv, limiterKvCalls } = createDurableObject();
    await seedUser(kv, 'user-1');

    const result = await postJson<{
      ok: boolean;
      leaseId?: string;
      activeCount: number;
      maxConcurrency: number;
    }>(durableObject, '/acquire', 'user-1', {
      requestId: 'req-1',
      maxConcurrency: 2,
      leaseTtlMs: 90_000,
    });

    expect(result.ok).toBe(true);
    expect(result.leaseId).toBeTruthy();
    expect(result.activeCount).toBe(1);

    const userRecord = await kv.getWithMetadata<{ concurrency: number }, unknown>('user:user-1', 'json');
    expect(userRecord.value?.concurrency).toBe(1);
    // 镜像必须经 WalletDO 写出，限流器不允许直接触碰 KV
    expect(limiterKvCalls).toEqual([]);
  });

  it('达到上限时拒绝新的 lease', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedUser(kv, 'user-1');

    await postJson(durableObject, '/acquire', 'user-1', {
      requestId: 'req-1',
      maxConcurrency: 1,
      leaseTtlMs: 90_000,
    });

    const result = await postJson<{ ok: boolean; activeCount: number }>(durableObject, '/acquire', 'user-1', {
      requestId: 'req-2',
      maxConcurrency: 1,
      leaseTtlMs: 90_000,
    });

    expect(result.ok).toBe(false);
    expect(result.activeCount).toBe(1);
  });

  it('相同 requestId 重复 acquire 时保持幂等', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedUser(kv, 'user-1');

    const first = await postJson<{ ok: boolean; leaseId?: string; activeCount: number }>(
      durableObject,
      '/acquire',
      'user-1',
      {
        requestId: 'req-1',
        maxConcurrency: 2,
        leaseTtlMs: 90_000,
      },
    );
    const second = await postJson<{ ok: boolean; leaseId?: string; activeCount: number }>(
      durableObject,
      '/acquire',
      'user-1',
      {
        requestId: 'req-1',
        maxConcurrency: 2,
        leaseTtlMs: 90_000,
      },
    );

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.leaseId).toBe(first.leaseId);
    expect(second.activeCount).toBe(1);

    const userRecord = await kv.getWithMetadata<{ concurrency: number }, unknown>('user:user-1', 'json');
    expect(userRecord.value?.concurrency).toBe(1);
  });

  it('release 可以重复调用且不会出现负数', async () => {
    const { durableObject, kv } = createDurableObject();
    await seedUser(kv, 'user-1');

    const acquireResult = await postJson<{ leaseId?: string }>(durableObject, '/acquire', 'user-1', {
      requestId: 'req-1',
      maxConcurrency: 2,
      leaseTtlMs: 90_000,
    });

    const firstRelease = await postJson<{ ok: boolean; activeCount: number }>(durableObject, '/release', 'user-1', {
      leaseId: acquireResult.leaseId,
    });
    const secondRelease = await postJson<{ ok: boolean; activeCount: number }>(durableObject, '/release', 'user-1', {
      leaseId: acquireResult.leaseId,
    });

    expect(firstRelease.ok).toBe(true);
    expect(firstRelease.activeCount).toBe(0);
    expect(secondRelease.ok).toBe(true);
    expect(secondRelease.activeCount).toBe(0);

    const userRecord = await kv.getWithMetadata<{ concurrency: number }, unknown>('user:user-1', 'json');
    expect(userRecord.value?.concurrency).toBe(0);
  });

  it('过期 lease 会被 alarm 清理并释放镜像', async () => {
    const { durableObject, kv, storage } = createDurableObject();
    await seedUser(kv, 'user-1');

    const acquireResult = await postJson<{ leaseId?: string }>(durableObject, '/acquire', 'user-1', {
      requestId: 'req-1',
      maxConcurrency: 1,
      leaseTtlMs: 10,
    });

    expect(acquireResult.leaseId).toBeTruthy();
    vi.setSystemTime(new Date('2026-04-19T00:00:01.000Z'));

    await durableObject.alarm();

    const userRecord = await kv.getWithMetadata<{ concurrency: number }, unknown>('user:user-1', 'json');
    expect(userRecord.value?.concurrency).toBe(0);
    expect(await storage.getAlarm()).toBeNull();

    const reacquire = await postJson<{ ok: boolean; activeCount: number }>(durableObject, '/acquire', 'user-1', {
      requestId: 'req-2',
      maxConcurrency: 1,
      leaseTtlMs: 90_000,
    });
    expect(reacquire.ok).toBe(true);
    expect(reacquire.activeCount).toBe(1);
  });

  it('alarm 同步镜像不会用旧余额覆盖 KV（2026-07-21 充值未到账事故回归）', async () => {
    const { durableObject, kv, walletDO, limiterKvCalls } = createDurableObject();
    await seedUser(kv, 'user-1');

    // 请求进行中（持有 lease），随后钱包发生充值
    await postJson(durableObject, '/acquire', 'user-1', {
      requestId: 'req-1',
      maxConcurrency: 1,
      leaseTtlMs: 10,
    });
    await postJson(walletDO, '/add', 'user-1', { amount: 20 });

    // 模拟旧实现的事故现场：KV 镜像被写回充值前的旧值
    await kv.put(`user:user-1`, JSON.stringify({ balance: 10, concurrency: 1, isSuspended: false }), {
      metadata: { email: 'user-1@test.com', createdAt: '2026-04-19T00:00:00.000Z', maxConcurrency: 2 },
    });

    // lease 过期，alarm 清理并同步镜像：必须以权威账本为准，而不是把 KV 旧值抄回去
    vi.setSystemTime(new Date('2026-04-19T00:00:01.000Z'));
    await durableObject.alarm();

    const mirrored = await kv.getWithMetadata<{ balance: number; concurrency: number }, unknown>('user:user-1', 'json');
    expect(mirrored.value?.balance).toBe(30);
    expect(mirrored.value?.concurrency).toBe(0);
    expect(limiterKvCalls).toEqual([]);
  });
});
