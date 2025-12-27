import type { KVUserData, KVUserMetadata } from "../types";
import { hashApiKey } from "../lib/crypto";

const USER_KEY_PREFIX = "user:";
const APIKEY_PREFIX = "apikey:";
const CONCURRENCY_TTL = 60; // 60秒 TTL，防止程序崩溃导致计数器不归零

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
    private defaultMaxConcurrency: number = 3
  ) { }

  // ==================== 用户数据 ====================

  /**
   * 获取用户数据
   */
  async getUser(
    userId: string
  ): Promise<{ data: KVUserData | null; metadata: KVUserMetadata | null }> {
    const result = await this.kv.getWithMetadata<KVUserData, KVUserMetadata>(
      `${USER_KEY_PREFIX}${userId}`,
      "json"
    );
    return {
      data: result.value,
      metadata: result.metadata,
    };
  }

  /**
   * 创建或更新用户
   */
  async setUser(
    userId: string,
    data: KVUserData,
    metadata: KVUserMetadata
  ): Promise<void> {
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
      throw new Error("用户不存在");
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
   * 根据邮箱查找用户（需遍历，效率较低，仅用于充值等低频操作）
   * 返回 userId 或 null
   */
  async findUserByEmail(email: string): Promise<string | null> {
    const list = await this.kv.list({ prefix: USER_KEY_PREFIX });
    for (const key of list.keys) {
      const { metadata } = await this.kv.getWithMetadata<KVUserData, KVUserMetadata>(
        key.name,
        "json"
      );
      if (metadata?.email === email) {
        return key.name.replace(USER_KEY_PREFIX, "");
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
   * 尝试获取并发槽位
   * 返回 true 表示成功，false 表示超限
   */
  async acquireConcurrency(userId: string): Promise<boolean> {
    const { data, metadata } = await this.getUser(userId);
    if (!data || !metadata) return false;

    const maxConcurrency = metadata.maxConcurrency ?? this.defaultMaxConcurrency;

    if (data.concurrency >= maxConcurrency) {
      return false;
    }

    data.concurrency++;
    await this.setUser(userId, data, metadata);
    return true;
  }

  /**
   * 释放并发槽位
   */
  async releaseConcurrency(userId: string): Promise<void> {
    const { data, metadata } = await this.getUser(userId);
    if (data && metadata) {
      data.concurrency = Math.max(0, data.concurrency - 1);
      await this.setUser(userId, data, metadata);
    }
  }

  // ==================== API Key ====================

  /**
   * 存储 API Key（哈希后）
   */
  async storeApiKey(
    rawKey: string,
    userId: string,
    keyPrefix: string
  ): Promise<void> {
    const keyHash = await hashApiKey(rawKey);
    const metadata: ApiKeyMetadata = {
      keyPrefix,
      isActive: true,
      userId,
    };
    await this.kv.put(`${APIKEY_PREFIX}${keyHash}`, userId, { metadata });
  }

  /**
   * 验证 API Key，返回 userId 或 null
   */
  async validateApiKey(rawKey: string): Promise<string | null> {
    const keyHash = await hashApiKey(rawKey);
    const result = await this.kv.getWithMetadata<string, ApiKeyMetadata>(
      `${APIKEY_PREFIX}${keyHash}`,
      "text"
    );

    if (!result.value || !result.metadata?.isActive) {
      return null;
    }

    return result.value;
  }

  /**
   * 禁用 API Key
   */
  async disableApiKey(rawKey: string): Promise<void> {
    const keyHash = await hashApiKey(rawKey);
    const result = await this.kv.getWithMetadata<string, ApiKeyMetadata>(
      `${APIKEY_PREFIX}${keyHash}`,
      "text"
    );

    if (result.value && result.metadata) {
      result.metadata.isActive = false;
      await this.kv.put(`${APIKEY_PREFIX}${keyHash}`, result.value, {
        metadata: result.metadata,
      });
    }
  }
}
