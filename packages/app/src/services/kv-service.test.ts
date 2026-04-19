import { describe, expect, it, vi, beforeEach } from 'vitest';

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
    it('should create a new user', async () => {
      const service = new KVService(mockKV as unknown as KVNamespace, 3);

      await service.createUser('user-1', 'test@example.com', 10);

      const { data, metadata } = await service.getUser('user-1');
      expect(data).toEqual({ balance: 10, concurrency: 0 });
      expect(metadata?.email).toBe('test@example.com');
    });

    it('should get user balance', async () => {
      const service = new KVService(mockKV as unknown as KVNamespace, 3);
      await service.createUser('user-1', 'test@example.com', 25.5);

      const balance = await service.getBalance('user-1');
      expect(balance).toBe(25.5);
    });

    it('should return 0 for non-existent user balance', async () => {
      const service = new KVService(mockKV as unknown as KVNamespace, 3);

      const balance = await service.getBalance('non-existent');
      expect(balance).toBe(0);
    });

    it('should add balance to existing user', async () => {
      const service = new KVService(mockKV as unknown as KVNamespace, 3);
      await service.createUser('user-1', 'test@example.com', 10);

      const newBalance = await service.addBalance('user-1', 5);
      expect(newBalance).toBe(15);
    });

    it('should deduct balance from user', async () => {
      const service = new KVService(mockKV as unknown as KVNamespace, 3);
      await service.createUser('user-1', 'test@example.com', 10);

      const result = await service.deductBalance('user-1', 3);
      expect(result).toBe(true);

      const balance = await service.getBalance('user-1');
      expect(balance).toBe(7);
    });

    it('should not allow negative balance', async () => {
      const service = new KVService(mockKV as unknown as KVNamespace, 3);
      await service.createUser('user-1', 'test@example.com', 5);

      await service.deductBalance('user-1', 10);
      const balance = await service.getBalance('user-1');
      expect(balance).toBe(0);
    });
  });

  describe('Concurrency Control', () => {
    it('should update concurrency mirror', async () => {
      const service = new KVService(mockKV as unknown as KVNamespace, 3);
      await service.createUser('user-1', 'test@example.com', 10);

      await service.setConcurrencyMirror('user-1', 2);

      const { data } = await service.getUser('user-1');
      expect(data?.concurrency).toBe(2);
    });

    it('should keep mirror non-negative', async () => {
      const service = new KVService(mockKV as unknown as KVNamespace, 3);
      await service.createUser('user-1', 'test@example.com', 10);

      await service.setConcurrencyMirror('user-1', -3);

      const { data } = await service.getUser('user-1');
      expect(data?.concurrency).toBe(0);
    });

    it('should no-op for missing user', async () => {
      const service = new KVService(mockKV as unknown as KVNamespace, 3);

      await expect(service.setConcurrencyMirror('missing', 1)).resolves.toBeUndefined();
    });
  });

  describe('Find User By Email', () => {
    it('should find user by email', async () => {
      const service = new KVService(mockKV as unknown as KVNamespace, 3);
      await service.createUser('user-1', 'test@example.com', 10);
      await service.createUser('user-2', 'other@example.com', 20);

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
