import { describe, expect, it, vi, beforeEach } from 'vitest';
import { KeyService } from './key-service';

// Mock KVService
function createMockKvService() {
  return {
    storeApiKey: vi.fn(),
    validateApiKey: vi.fn(),
  };
}

// Mock Database
function createMockDb() {
  return {
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
    query: {
      claimTokens: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  };
}

describe('KeyService', () => {
  let kvService: ReturnType<typeof createMockKvService>;
  let db: ReturnType<typeof createMockDb>;
  let service: KeyService;

  beforeEach(() => {
    kvService = createMockKvService();
    db = createMockDb();
    service = new KeyService(db as never, kvService as never);
  });

  describe('generateKey', () => {
    it('生成 API Key 并存储到 KV', async () => {
      const result = await service.generateKey('user-1');

      expect(result.rawKey).toMatch(/^sk-gw-/);
      expect(result.keyPrefix).toBeTruthy();
      expect(result.keyId).toBeTruthy();
      expect(kvService.storeApiKey).toHaveBeenCalledWith(result.rawKey, 'user-1', result.keyPrefix);
    });

    it('每次生成不同的 key', async () => {
      const r1 = await service.generateKey('user-1');
      const r2 = await service.generateKey('user-1');
      expect(r1.rawKey).not.toBe(r2.rawKey);
      expect(r1.keyId).not.toBe(r2.keyId);
    });
  });

  describe('createClaimToken', () => {
    it('创建 15 分钟有效的 claim token', async () => {
      const before = Date.now();
      const result = await service.createClaimToken('user-1', 'sk-gw-rawkey');
      const after = Date.now();

      expect(result.token).toBeTruthy();
      // 过期时间应在 15 分钟左右
      const expiresMs = result.expiresAt.getTime();
      expect(expiresMs).toBeGreaterThanOrEqual(before + 15 * 60 * 1000 - 100);
      expect(expiresMs).toBeLessThanOrEqual(after + 15 * 60 * 1000 + 100);

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('claimApiKey', () => {
    it('成功领取未使用、未过期的 token', async () => {
      db.query.claimTokens.findFirst.mockResolvedValue({
        token: 'tk-1',
        userId: 'user-1',
        tempRawKey: 'sk-gw-raw',
        expiresAt: new Date(Date.now() + 60000),
        used: false,
      });

      const result = await service.claimApiKey('tk-1');
      expect(result.success).toBe(true);
      expect(result.rawKey).toBe('sk-gw-raw');
      expect(db.update).toHaveBeenCalled();
    });

    it('拒绝不存在的 token', async () => {
      db.query.claimTokens.findFirst.mockResolvedValue(null);
      const result = await service.claimApiKey('nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('不存在');
    });

    it('拒绝已使用的 token', async () => {
      db.query.claimTokens.findFirst.mockResolvedValue({
        token: 'tk-1',
        used: true,
        expiresAt: new Date(Date.now() + 60000),
        tempRawKey: '',
      });
      const result = await service.claimApiKey('tk-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('已被使用');
    });

    it('拒绝过期的 token', async () => {
      db.query.claimTokens.findFirst.mockResolvedValue({
        token: 'tk-1',
        used: false,
        expiresAt: new Date(Date.now() - 60000),
        tempRawKey: 'sk-gw-raw',
      });
      const result = await service.claimApiKey('tk-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('已过期');
    });
  });

  describe('validateApiKey', () => {
    it('委托给 KVService', async () => {
      kvService.validateApiKey.mockResolvedValue({ userId: 'user-1', keyHash: 'hash-abc' });
      const result = await service.validateApiKey('sk-gw-raw');
      expect(result).toBe('user-1');
      expect(kvService.validateApiKey).toHaveBeenCalledWith('sk-gw-raw');
    });

    it('无效 key 返回 null', async () => {
      kvService.validateApiKey.mockResolvedValue(null);
      const result = await service.validateApiKey('invalid');
      expect(result).toBeNull();
    });
  });
});
