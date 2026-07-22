import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { KVUserData, KVUserMetadata } from '../types';

// Mock KVNamespace
function createMockKV() {
  const store = new Map<string, { value: string; metadata?: unknown }>();

  return {
    get: vi.fn(async (key: string) => store.get(key)?.value ?? null),
    getWithMetadata: vi.fn(async (key: string, type?: string) => {
      const item = store.get(key);
      if (!item) return { value: null, metadata: null };
      return {
        value: type === 'json' ? JSON.parse(item.value) : item.value,
        metadata: item.metadata ?? null,
      };
    }),
    put: vi.fn(async (key: string, value: string, options?: { metadata?: unknown }) => {
      store.set(key, { value, metadata: options?.metadata });
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async (options?: { prefix?: string }) => {
      const keys: { name: string }[] = [];
      for (const key of store.keys()) {
        if (!options?.prefix || key.startsWith(options.prefix)) {
          keys.push({ name: key });
        }
      }
      return { keys };
    }),
    _store: store, // 用于测试内部检查
  };
}

function seedUser(userId: string, email: string, balance: number): [string, KVUserData, KVUserMetadata] {
  return [userId, { balance, concurrency: 0 }, { email, createdAt: new Date().toISOString() }];
}

// 需要动态导入以便 mock 能生效
describe('KVService', () => {
  let mockKV: ReturnType<typeof createMockKV>;
  let KVService: typeof import('./kv-service').KVService;

  beforeEach(async () => {
    mockKV = createMockKV();
    const module = await import('./kv-service');
    KVService = module.KVService;
  });

  describe('User Operations', () => {
    it('should get user balance', async () => {
      const service = new KVService(mockKV as unknown as KVNamespace, 3);
      const [userId, data, metadata] = seedUser('user-1', 'test@example.com', 25.5);
      await service.setUser(userId, data, metadata);

      const balance = await service.getBalance('user-1');
      expect(balance).toBe(25.5);
    });

    it('should return 0 for non-existent user balance', async () => {
      const service = new KVService(mockKV as unknown as KVNamespace, 3);

      const balance = await service.getBalance('non-existent');
      expect(balance).toBe(0);
    });
  });

  describe('Find User By Email', () => {
    it('should find user by email', async () => {
      const service = new KVService(mockKV as unknown as KVNamespace, 3);
      const [userId1, data1, metadata1] = seedUser('user-1', 'test@example.com', 10);
      const [userId2, data2, metadata2] = seedUser('user-2', 'other@example.com', 20);
      await service.setUser(userId1, data1, metadata1);
      await service.setUser(userId2, data2, metadata2);

      const userId = await service.findUserByEmail('test@example.com');
      expect(userId).toBe('user-1');
    });

    it('should return null for non-existent email', async () => {
      const service = new KVService(mockKV as unknown as KVNamespace, 3);

      const userId = await service.findUserByEmail('notfound@example.com');
      expect(userId).toBeNull();
    });
  });
});
