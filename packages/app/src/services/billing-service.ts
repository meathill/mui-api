import { eq, sql } from "drizzle-orm";
import type { Database } from "../db";
import { models, usageLogs, wallets, type NewUsageLog } from "../db/schema";
import { generateId } from "../lib/crypto";

// 默认模型定价（每 1M tokens，USD）
const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-4": { input: 30, output: 60 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
};

const DEFAULT_MARKUP_RATE = 1.2;

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/**
 * 计费服务：计算费用、扣除余额、记录使用
 */
export class BillingService {
  constructor(private db: Database) { }

  /**
   * 计算请求费用
   */
  async calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): Promise<number> {
    // 先尝试从数据库获取定价
    const modelConfig = await this.db.query.models.findFirst({
      where: eq(models.id, model),
    });

    let inputPrice: number;
    let outputPrice: number;
    let markupRate: number;

    if (modelConfig) {
      inputPrice = modelConfig.inputPrice ?? 0;
      outputPrice = modelConfig.outputPrice ?? 0;
      markupRate = modelConfig.markupRate ?? DEFAULT_MARKUP_RATE;
    } else {
      // 使用默认定价
      const defaultPricing = DEFAULT_PRICING[model] ?? DEFAULT_PRICING["gpt-4o-mini"];
      inputPrice = defaultPricing.input;
      outputPrice = defaultPricing.output;
      markupRate = DEFAULT_MARKUP_RATE;
    }

    // 计算费用：(tokens / 1M) * price * markup
    const inputCost = (inputTokens / 1_000_000) * inputPrice;
    const outputCost = (outputTokens / 1_000_000) * outputPrice;
    const totalCost = (inputCost + outputCost) * markupRate;

    return totalCost;
  }

  /**
   * 扣除用户余额
   */
  async deductBalance(userId: string, cost: number): Promise<void> {
    await this.db
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} - ${cost}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.userId, userId));
  }

  /**
   * 记录使用日志
   */
  async logUsage(
    userId: string,
    apiKeyId: string | null,
    model: string,
    inputTokens: number,
    outputTokens: number,
    cost: number
  ): Promise<void> {
    const log: NewUsageLog = {
      id: generateId(),
      userId,
      apiKeyId,
      modelId: model,
      inputTokens,
      outputTokens,
      cost,
    };

    await this.db.insert(usageLogs).values(log);
  }

  /**
   * 处理完整的计费流程（计算 + 扣费 + 记录）
   */
  async processUsage(
    userId: string,
    apiKeyId: string | null,
    usage: UsageInfo
  ): Promise<number> {
    const cost = await this.calculateCost(
      usage.model,
      usage.inputTokens,
      usage.outputTokens
    );

    await this.deductBalance(userId, cost);
    await this.logUsage(
      userId,
      apiKeyId,
      usage.model,
      usage.inputTokens,
      usage.outputTokens,
      cost
    );

    return cost;
  }
}
