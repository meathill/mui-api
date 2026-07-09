// 实现已上移到 @muirouter/shared-db/crypto（app 与 dashboard 共用）；
// 测试保留在 app 包运行，因为 shared-db 无独立测试基建。

import { generateApiKey, generateId, getKeyPrefix, hashApiKey } from '@muirouter/shared-db/crypto';
import { describe, expect, it } from 'vitest';

describe('Crypto Utilities', () => {
  describe('generateId', () => {
    it('should generate a valid UUID', () => {
      const id = generateId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateApiKey', () => {
    it('should generate key with sk-gw- prefix', () => {
      const key = generateApiKey();
      expect(key.startsWith('sk-gw-')).toBe(true);
    });

    it('should generate keys of sufficient length', () => {
      const key = generateApiKey();
      expect(key.length).toBeGreaterThan(40);
    });

    it('should generate unique keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('hashApiKey', () => {
    it('should return a 64-character hex string', async () => {
      const hash = await hashApiKey('test-key');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce consistent hashes', async () => {
      const hash1 = await hashApiKey('same-key');
      const hash2 = await hashApiKey('same-key');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different keys', async () => {
      const hash1 = await hashApiKey('key-1');
      const hash2 = await hashApiKey('key-2');
      expect(hash1).not.toBe(hash2);
    });

    // dashboard 写 KV apikey:{hash}、app 按同一算法验证，算法一旦变化所有已发 key 立即失效。
    // 固定向量守护：任何改动导致此断言失败，说明破坏了两包互认。
    it('should match the known SHA-256 vector', async () => {
      const hash = await hashApiKey('sk-gw-known-vector');
      expect(hash).toBe('608bd042977be9f42d8cd562073558187fe6304ac3ac5daf9c32c5db8ded1f6f');
    });
  });

  describe('getKeyPrefix', () => {
    it('should return first 12 characters plus ellipsis', () => {
      const key = 'sk-gw-abcdefghijklmnop';
      const prefix = getKeyPrefix(key);
      expect(prefix).toBe('sk-gw-abcdef...');
    });
  });
});
