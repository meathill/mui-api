import { generateApiKey, generateId, getKeyPrefix } from '../lib/crypto';
import type { KVService } from './kv-service';

export interface GenerateKeyResult {
  rawKey: string;
  keyPrefix: string;
  keyId: string;
}

/**
 * 密钥服务：管理 API Key（KV）
 */
export class KeyService {
  constructor(private kvService: KVService) {}

  /**
   * 为用户生成新的 API Key（存储到 KV）
   */
  async generateKey(userId: string): Promise<GenerateKeyResult> {
    const rawKey = generateApiKey();
    const keyPrefix = getKeyPrefix(rawKey);
    const keyId = generateId();

    await this.kvService.storeApiKey(rawKey, userId, keyPrefix);

    return {
      rawKey,
      keyPrefix,
      keyId,
    };
  }

  /**
   * 验证 API Key（从 KV），返回 userId
   */
  async validateApiKey(rawKey: string): Promise<string | null> {
    const result = await this.kvService.validateApiKey(rawKey);
    return result?.userId ?? null;
  }
}
