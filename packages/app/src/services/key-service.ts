import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { claimTokens, type NewClaimToken } from "../db/schema";
import type { KVService } from "./kv-service";
import {
  generateId,
  generateApiKey,
  generateClaimToken,
  getKeyPrefix,
} from "../lib/crypto";

export interface GenerateKeyResult {
  rawKey: string;
  keyPrefix: string;
  keyId: string;
}

export interface CreateClaimResult {
  token: string;
  expiresAt: Date;
}

export interface ClaimResult {
  success: boolean;
  rawKey?: string;
  error?: string;
}

/**
 * 密钥服务：管理 API Key（KV）和 Claim Token（D1）
 */
export class KeyService {
  constructor(
    private db: Database,
    private kvService: KVService
  ) { }

  /**
   * 为用户生成新的 API Key（存储到 KV）
   */
  async generateKey(userId: string, _name?: string): Promise<GenerateKeyResult> {
    const rawKey = generateApiKey();
    const keyPrefix = getKeyPrefix(rawKey);
    const keyId = generateId();

    // 存储到 KV
    await this.kvService.storeApiKey(rawKey, userId, keyPrefix);

    return {
      rawKey,
      keyPrefix,
      keyId,
    };
  }

  /**
   * 创建 Claim Token（15 分钟有效，存储到 D1）
   */
  async createClaimToken(userId: string, rawKey: string): Promise<CreateClaimResult> {
    const token = generateClaimToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const newClaim: NewClaimToken = {
      token,
      userId,
      tempRawKey: rawKey,
      expiresAt,
      used: false,
    };

    await this.db.insert(claimTokens).values(newClaim);

    return {
      token,
      expiresAt,
    };
  }

  /**
   * 领取 API Key（一次性）
   */
  async claimApiKey(token: string): Promise<ClaimResult> {
    const claim = await this.db.query.claimTokens.findFirst({
      where: eq(claimTokens.token, token),
    });

    if (!claim) {
      return { success: false, error: "Token 不存在" };
    }

    if (claim.used) {
      return { success: false, error: "Token 已被使用" };
    }

    if (new Date(claim.expiresAt) < new Date()) {
      return { success: false, error: "Token 已过期" };
    }

    const rawKey = claim.tempRawKey;

    // 标记为已使用并清空明文 Key
    await this.db
      .update(claimTokens)
      .set({
        used: true,
        tempRawKey: "",
      })
      .where(eq(claimTokens.token, token));

    return {
      success: true,
      rawKey,
    };
  }

  /**
   * 验证 API Key（从 KV）
   */
  async validateApiKey(rawKey: string): Promise<string | null> {
    return this.kvService.validateApiKey(rawKey);
  }
}
