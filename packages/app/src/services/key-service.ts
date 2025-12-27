import { eq, and, lt, sql } from "drizzle-orm";
import type { Database } from "../db";
import { apiKeys, claimTokens, type NewApiKey, type NewClaimToken } from "../db/schema";
import {
  generateId,
  generateApiKey,
  generateClaimToken,
  hashApiKey,
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
 * 密钥服务：管理 API Key 和 Claim Token
 */
export class KeyService {
  constructor(private db: Database) { }

  /**
   * 为用户生成新的 API Key
   */
  async generateKey(userId: string, name?: string): Promise<GenerateKeyResult> {
    const rawKey = generateApiKey();
    const keyHash = await hashApiKey(rawKey);
    const keyPrefix = getKeyPrefix(rawKey);
    const keyId = generateId();

    const newKey: NewApiKey = {
      id: keyId,
      userId,
      keyPrefix,
      keyHash,
      name: name ?? "Default Key",
      isActive: true,
    };

    await this.db.insert(apiKeys).values(newKey);

    return {
      rawKey,
      keyPrefix,
      keyId,
    };
  }

  /**
   * 创建 Claim Token（15 分钟有效）
   */
  async createClaimToken(userId: string, rawKey: string): Promise<CreateClaimResult> {
    const token = generateClaimToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 分钟

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
   * 验证 API Key 并返回用户 ID
   */
  async validateApiKey(rawKey: string): Promise<string | null> {
    const keyHash = await hashApiKey(rawKey);
    const key = await this.db.query.apiKeys.findFirst({
      where: and(
        eq(apiKeys.keyHash, keyHash),
        eq(apiKeys.isActive, true)
      ),
    });
    return key?.userId ?? null;
  }
}
