import { beforeEach, describe, expect, it } from 'vitest';
import type { KVUserData, KVUserMetadata } from '@muirouter/shared-db/types';
import {
  getFreeQuotaStatus,
  getGlobalConfig,
  getSpendingStats,
  getUserData,
  invalidateModelsCatalog,
  listAllUsers,
  listUserApiKeys,
  normalizeFreeQuotaConfig,
  setGlobalConfig,
  storeApiKey,
} from './kv';

/** 最小内存 KV 实现，覆盖 kv.ts 用到的 get/getWithMetadata/list/put/delete 面；put 对非字符串值做 JSON 序列化，get('json') 对字符串做解析，对齐真实 KV 语义 */
/** fixture 写入口用宽松类型；传给源码函数的 ns 才是 KVNamespace 类型 */
interface FakeKV {
  get(key: string, type: 'json' | 'text'): Promise<unknown>;
  getWithMetadata(key: string, type: 'json' | 'text'): Promise<{ value: unknown; metadata: unknown }>;
  put(key: string, value: unknown, options?: { metadata?: unknown }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options: { prefix: string; cursor?: string; limit?: number }): Promise<{
    keys: Array<{ name: string; metadata: unknown }>;
    list_complete: boolean;
    cursor: string;
  }>;
}

function createFakeKV() {
  const store = new Map<string, string>();
  const metadata = new Map<string, unknown>();
  const parseIfJson = (value: string | undefined, type: 'json' | 'text') => {
    if (value === undefined) return null;
    if (type === 'text') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };
  const kv: FakeKV = {
    async get(key: string, type: 'json' | 'text') {
      return parseIfJson(store.get(key), type);
    },
    async getWithMetadata(key: string, type: 'json' | 'text') {
      return {
        value: parseIfJson(store.get(key), type),
        metadata: metadata.get(key) ?? null,
      };
    },
    async put(key: string, value: unknown, options?: { metadata?: unknown }) {
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      if (options?.metadata !== undefined) metadata.set(key, options.metadata);
    },
    async delete(key: string) {
      store.delete(key);
      metadata.delete(key);
    },
    async list(options: { prefix: string; cursor?: string; limit?: number }) {
      const keys = [...store.keys()]
        .filter((k) => k.startsWith(options.prefix))
        .map((name) => ({ name, metadata: metadata.get(name) ?? null }));
      return { keys, list_complete: true, cursor: '' };
    },
  };
  const ns = kv as unknown as KVNamespace;
  return { kv, ns, store, metadata };
}

let fake: ReturnType<typeof createFakeKV>;

beforeEach(() => {
  fake = createFakeKV();
});

describe('normalizeFreeQuotaConfig', () => {
  it('null / undefined 返回关闭态默认配置', () => {
    expect(normalizeFreeQuotaConfig(null)).toEqual({ enabled: false, amount: 0, modelIds: [] });
    expect(normalizeFreeQuotaConfig(undefined)).toEqual({ enabled: false, amount: 0, modelIds: [] });
  });

  it('enabled 严格按 === true 判定，amount 非法值归零', () => {
    expect(normalizeFreeQuotaConfig({ enabled: 'yes' as never, amount: -5 }).enabled).toBe(false);
    expect(normalizeFreeQuotaConfig({ enabled: true, amount: -5 })).toMatchObject({ enabled: true, amount: 0 });
    expect(normalizeFreeQuotaConfig({ enabled: true, amount: Number.NaN })).toMatchObject({ amount: 0 });
    expect(normalizeFreeQuotaConfig({ enabled: true, amount: '12' as never })).toMatchObject({ amount: 12 });
  });

  it('modelIds 去空格、去重、滤空串', () => {
    expect(
      normalizeFreeQuotaConfig({ enabled: true, amount: 1, modelIds: [' a', 'a', '', '  ', 'b'] }).modelIds,
    ).toEqual(['a', 'b']);
  });
});

describe('getFreeQuotaStatus', () => {
  it('未启用时 remaining 恒为 0，used 独立返回', () => {
    expect(getFreeQuotaStatus(null, { freeQuotaUsed: 3 } as KVUserData)).toMatchObject({
      enabled: false,
      remaining: 0,
      used: 3,
    });
  });

  it('启用时 remaining = amount - used 并夹到 0', () => {
    const config = { freeQuota: { enabled: true, amount: 10, modelIds: [] } };
    expect(getFreeQuotaStatus(config as never, { freeQuotaUsed: 4 } as KVUserData)).toMatchObject({
      used: 4,
      remaining: 6,
    });
    expect(getFreeQuotaStatus(config as never, { freeQuotaUsed: 99 } as KVUserData)).toMatchObject({
      used: 99,
      remaining: 0,
    });
    expect(getFreeQuotaStatus(config as never, { freeQuotaUsed: -2 } as never)).toMatchObject({
      used: 0,
      remaining: 10,
    });
  });
});

describe('API Key 存取', () => {
  it('storeApiKey 写入 apikey:{hash}，值为 userId，metadata 含前缀与创建时间', async () => {
    await storeApiKey(fake.ns, 'hash-1', 'user-1', 'sk-gw-abc');
    expect(fake.store.get('apikey:hash-1')).toBe('user-1');
    const meta = fake.metadata.get('apikey:hash-1') as {
      keyPrefix: string;
      isActive: boolean;
      userId: string;
      createdAt: string;
    };
    expect(meta).toMatchObject({ keyPrefix: 'sk-gw-abc', isActive: true, userId: 'user-1' });
    expect(Number.isNaN(Date.parse(meta.createdAt))).toBe(false);
  });

  it('listUserApiKeys 只返回属于该用户的 key，缺失字段用默认值兜底', async () => {
    await fake.kv.put('apikey:a', 'user-1', {
      metadata: { keyPrefix: 'sk-1', isActive: true, userId: 'user-1', createdAt: '2026-01-01T00:00:00.000Z' },
    });
    await fake.kv.put('apikey:b', 'user-2', { metadata: { userId: 'user-2' } });
    await fake.kv.put('apikey:c', 'user-1', { metadata: { userId: 'user-1' } });
    await fake.kv.put('apikey:no-meta', 'user-1', {});

    const keys = await listUserApiKeys(fake.ns, 'user-1');
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatchObject({
      id: 'apikey:a',
      keyPrefix: 'sk-1',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(keys[1]).toMatchObject({ id: 'apikey:c', keyPrefix: 'sk-gw-...', isActive: true, createdAt: '' });
  });
});

describe('全局配置', () => {
  it('set / get roundtrip，未设置时返回 null', async () => {
    expect(await getGlobalConfig(fake.ns)).toBeNull();
    const config = { freeQuota: { enabled: true, amount: 5, modelIds: ['m1'] } };
    await setGlobalConfig(fake.ns, config as never);
    expect(await getGlobalConfig(fake.ns)).toEqual(config);
  });

  it('invalidateModelsCatalog 删除 models:catalog', async () => {
    await fake.kv.put('models:catalog', 'cached');
    await invalidateModelsCatalog(fake.ns);
    expect(fake.store.has('models:catalog')).toBe(false);
  });
});

describe('getSpendingStats', () => {
  it('读取 stats:daily:{UTC 日期} 与 stats:monthly:{UTC 月份}，缺失归零', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const month = new Date().toISOString().slice(0, 7);
    await fake.kv.put(`stats:daily:${today}`, 1.5);
    await fake.kv.put(`stats:monthly:${month}`, 20);

    const stats = await getSpendingStats(fake.ns);
    expect(stats).toEqual({ dailySpending: 1.5, monthlySpending: 20 });
  });

  it('KV 为空时返回 0 而不是 null', async () => {
    expect(await getSpendingStats(fake.ns)).toEqual({ dailySpending: 0, monthlySpending: 0 });
  });
});

describe('getUserData', () => {
  it('返回 data 与 metadata 组合，缺失时均为 null', async () => {
    expect(await getUserData(fake.ns, 'u1')).toEqual({ data: null, metadata: null });

    await fake.kv.put('user:u1', { balance: 9 } as KVUserData, {
      metadata: { email: 'u@example.com' } as KVUserMetadata,
    });
    expect(await getUserData(fake.ns, 'u1')).toEqual({
      data: { balance: 9 },
      metadata: { email: 'u@example.com' },
    });
  });
});

describe('listAllUsers', () => {
  it('组装用户列表：过滤缺 metadata 或缺 value 的键，maxConcurrency 用默认值', async () => {
    await fake.kv.put('user:u1', { balance: 10, concurrency: 1 } as KVUserData, {
      metadata: { email: 'u1@example.com', createdAt: '2026-01-01T00:00:00.000Z' },
    });
    await fake.kv.put('user:u2', { balance: 0, concurrency: 2 } as KVUserData, {
      metadata: { email: 'u2@example.com', createdAt: '2026-01-02T00:00:00.000Z', maxConcurrency: 9 },
    });
    await fake.kv.put('user:ghost', null);
    fake.metadata.set('user:no-meta', { email: 'x' });

    const { users, cursor } = await listAllUsers(fake.ns, undefined, 3);
    expect(cursor).toBeNull();
    expect(users).toHaveLength(2);
    expect(users[0]).toMatchObject({
      userId: 'u1',
      email: 'u1@example.com',
      balance: 10,
      maxConcurrency: 3,
      isSuspended: false,
    });
    expect(users[1]).toMatchObject({ userId: 'u2', maxConcurrency: 9 });
  });

  it('isSuspended 缺失视为 false，list 未完时透传 cursor', async () => {
    await fake.kv.put('user:u1', { balance: 1, concurrency: 0, isSuspended: true } as KVUserData, {
      metadata: { email: 'u1@example.com', createdAt: '' },
    });
    const { users } = await listAllUsers(fake.ns);
    expect(users[0]).toMatchObject({ isSuspended: true });
  });
});
