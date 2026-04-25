import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyService } from './key-service';

// Mock KVService
function createMockKvService() {
  return {
    storeApiKey: vi.fn(),
    validateApiKey: vi.fn(),
  };
}

describe('KeyService', () => {
  let kvService: ReturnType<typeof createMockKvService>;
  let service: KeyService;

  beforeEach(() => {
    kvService = createMockKvService();
    service = new KeyService(kvService as never);
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
