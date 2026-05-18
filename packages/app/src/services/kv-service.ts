import { hashApiKey } from '../lib/crypto';
import type { KVUserData, KVUserMetadata } from '../types';

import type { GlobalConfig } from './alert-service';
import type { Model } from '../db/schema';

const USER_KEY_PREFIX = 'user:';
const APIKEY_PREFIX = 'apikey:';
const GLOBAL_CONFIG_KEY = 'config:global';
const GLOBAL_SPENDING_PREFIX = 'stats:';
const USER_SPENDING_PREFIX = 'spending:user:';
const MODELS_CATALOG_KEY = 'models:catalog';

export interface ApiKeyMetadata {
  keyPrefix: string;
  isActive: boolean;
  userId: string;
}

/**
 * KV 服务：统一管理用户数据和 API Key
 */
export class KVService {
  constructor(
    private kv: KVNamespace,
    private defaultMaxConcurrency: number = 3,
  ) {}

  // ==================== 用户数据 ====================

  /**
   * 获取用户数据
   */
  async getUser(userId: string): Promise<{ data: KVUserData | null; metadata: KVUserMetadata | null }> {
    const result = await this.kv.getWithMetadata<KVUserData, KVUserMetadata>(`${USER_KEY_PREFIX}${userId}`, 'json');
    return {
      data: result.value,
      metadata: result.metadata,
    };
  }

  /**
   * 创建或更新用户
   */
  async setUser(userId: string, data: KVUserData, metadata: KVUserMetadata): Promise<void> {
    await this.kv.put(`${USER_KEY_PREFIX}${userId}`, JSON.stringify(data), {
      metadata,
    });
  }

  /**
   * 获取用户余额
   */
  async getBalance(userId: string): Promise<number> {
    const { data } = await this.getUser(userId);
    return data?.balance ?? 0;
  }

  /**
   * 更新用户余额
   */
  async updateBalance(userId: string, newBalance: number): Promise<void> {
    const { data, metadata } = await this.getUser(userId);
    if (data && metadata) {
      data.balance = newBalance;
      await this.setUser(userId, data, metadata);
    }
  }

  /**
   * 扣除余额
   */
  async deductBalance(userId: string, amount: number): Promise<boolean> {
    const { data, metadata } = await this.getUser(userId);
    if (!data || !metadata) return false;

    data.balance = Math.max(0, data.balance - amount);
    await this.setUser(userId, data, metadata);
    return true;
  }

  /**
   * 充值（增加余额）
   */
  async addBalance(userId: string, amount: number): Promise<number> {
    const { data, metadata } = await this.getUser(userId);
    if (!data || !metadata) {
      throw new Error('用户不存在');
    }

    data.balance += amount;
    await this.setUser(userId, data, metadata);
    return data.balance;
  }

  /**
   * 创建新用户
   */
  async createUser(userId: string, email: string, initialBalance: number = 0): Promise<void> {
    const data: KVUserData = {
      balance: initialBalance,
      concurrency: 0,
    };
    const metadata: KVUserMetadata = {
      email,
      createdAt: new Date().toISOString(),
    };
    await this.setUser(userId, data, metadata);
  }

  /**
   * 累加用户已使用的免费额度，单位 USD
   */
  async consumeFreeQuota(userId: string, amount: number): Promise<number> {
    const { data, metadata } = await this.getUser(userId);
    if (!data || !metadata || amount <= 0) return data?.freeQuotaUsed ?? 0;

    data.freeQuotaUsed = Math.max(0, (data.freeQuotaUsed ?? 0) + amount);
    await this.setUser(userId, data, metadata);
    return data.freeQuotaUsed;
  }

  /**
   * 根据邮箱查找用户（需遍历，效率较低，仅用于充值等低频操作）
   * 返回 userId 或 null
   */
  async findUserByEmail(email: string): Promise<string | null> {
    const list = await this.kv.list({ prefix: USER_KEY_PREFIX });
    for (const key of list.keys) {
      const { metadata } = await this.kv.getWithMetadata<KVUserData, KVUserMetadata>(key.name, 'json');
      if (metadata?.email === email) {
        return key.name.replace(USER_KEY_PREFIX, '');
      }
    }
    return null;
  }

  // ==================== 并发控制 ====================

  /**
   * 获取用户最大并发数
   */
  async getMaxConcurrency(userId: string): Promise<number> {
    const { metadata } = await this.getUser(userId);
    return metadata?.maxConcurrency ?? this.defaultMaxConcurrency;
  }

  /**
   * 更新并发展示镜像
   */
  async setConcurrencyMirror(userId: string, concurrency: number): Promise<void> {
    const { data, metadata } = await this.getUser(userId);
    if (!data || !metadata) return;

    if (data.concurrency === concurrency) {
      return;
    }

    data.concurrency = Math.max(0, concurrency);
    await this.setUser(userId, data, metadata);
  }

  // ==================== API Key ====================

  /**
   * 存储 API Key（哈希后）
   */
  async storeApiKey(rawKey: string, userId: string, keyPrefix: string): Promise<void> {
    const keyHash = await hashApiKey(rawKey);
    const metadata: ApiKeyMetadata = {
      keyPrefix,
      isActive: true,
      userId,
    };
    await this.kv.put(`${APIKEY_PREFIX}${keyHash}`, userId, { metadata });
  }

  /**
   * 验证 API Key，返回 userId 和 keyHash，或 null
   */
  async validateApiKey(rawKey: string): Promise<{ userId: string; keyHash: string } | null> {
    const keyHash = await hashApiKey(rawKey);
    const result = await this.kv.getWithMetadata(`${APIKEY_PREFIX}${keyHash}`, 'text');
    const metadata = result.metadata as ApiKeyMetadata | null;

    if (!result.value || !metadata?.isActive) {
      return null;
    }

    return { userId: result.value, keyHash };
  }

  // ==================== 消费统计 ====================

  /**
   * 获取全局配置
   */
  async getGlobalConfig(): Promise<GlobalConfig | null> {
    return this.kv.get<GlobalConfig>(GLOBAL_CONFIG_KEY, 'json');
  }

  /**
   * 设置全局配置
   */
  async setGlobalConfig(config: GlobalConfig): Promise<void> {
    await this.kv.put(GLOBAL_CONFIG_KEY, JSON.stringify(config));
  }

  /**
   * 读取模型 catalog 缓存。
   * 不设 TTL：模型表只有 admin CRUD 一条写路径，由 ModelCatalogService.refresh() 显式失效。
   */
  async getModelsCatalog(): Promise<Model[] | null> {
    return this.kv.get<Model[]>(MODELS_CATALOG_KEY, 'json');
  }

  /**
   * 写入模型 catalog 缓存。
   */
  async setModelsCatalog(models: Model[]): Promise<void> {
    await this.kv.put(MODELS_CATALOG_KEY, JSON.stringify(models));
  }

  /**
   * 累加全局消费（日/月），返回累加后的总值
   * key 例如 "daily:2026-03-11" 或 "monthly:2026-03"
   */
  async incrementGlobalSpending(key: string, amount: number, ttlSeconds: number): Promise<number> {
    const fullKey = `${GLOBAL_SPENDING_PREFIX}${key}`;
    const current = (await this.kv.get<number>(fullKey, 'json')) ?? 0;
    const newTotal = current + amount;
    await this.kv.put(fullKey, JSON.stringify(newTotal), {
      expirationTtl: ttlSeconds,
    });
    return newTotal;
  }

  /**
   * 累加用户月度消费，返回累加后的总值
   */
  async incrementUserMonthlySpending(userId: string, monthKey: string, amount: number): Promise<number> {
    const fullKey = `${USER_SPENDING_PREFIX}${userId}:${monthKey}`;
    const current = (await this.kv.get<number>(fullKey, 'json')) ?? 0;
    const newTotal = current + amount;
    await this.kv.put(fullKey, JSON.stringify(newTotal), {
      expirationTtl: 35 * 24 * 3600, // 35 天
    });
    return newTotal;
  }

  /**
   * 获取用户月度消费
   */
  async getUserMonthlySpending(userId: string, monthKey: string): Promise<number> {
    const fullKey = `${USER_SPENDING_PREFIX}${userId}:${monthKey}`;
    return (await this.kv.get<number>(fullKey, 'json')) ?? 0;
  }

  /**
   * 暂停用户
   */
  async suspendUser(userId: string): Promise<void> {
    const { data, metadata } = await this.getUser(userId);
    if (data && metadata) {
      data.isSuspended = true;
      await this.setUser(userId, data, metadata);
    }
  }

  /**
   * 解除用户暂停
   */
  async unsuspendUser(userId: string): Promise<void> {
    const { data, metadata } = await this.getUser(userId);
    if (data && metadata) {
      data.isSuspended = false;
      await this.setUser(userId, data, metadata);
    }
  }

  /**
   * 禁用 API Key
   */
  async disableApiKey(rawKey: string): Promise<void> {
    const keyHash = await hashApiKey(rawKey);
    const result = await this.kv.getWithMetadata(`${APIKEY_PREFIX}${keyHash}`, 'text');
    const metadata = result.metadata as ApiKeyMetadata | null;

    if (result.value && metadata) {
      metadata.isActive = false;
      await this.kv.put(`${APIKEY_PREFIX}${keyHash}`, result.value, {
        metadata,
      });
    }
  }
}
