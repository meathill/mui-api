import type { Database } from "../db";
import { usageLogs, type NewUsageLog } from "../db/schema";
import { generateId } from "../lib/crypto";
import type { KVService } from "./kv-service";

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
 * 计费服务：计算费用、扣除余额（KV）、记录使用日志（D1）
 */
export class BillingService {
  constructor(
    private kvService: KVService,
    private db: Database
  ) { }

  /**
   * 计算请求费用
   */
  calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const pricing = DEFAULT_PRICING[model] ?? DEFAULT_PRICING["gpt-4o-mini"];
    const inputPrice = pricing.input;
    const outputPrice = pricing.output;

    const inputCost = (inputTokens / 1_000_000) * inputPrice;
    const outputCost = (outputTokens / 1_000_000) * outputPrice;
    const totalCost = (inputCost + outputCost) * DEFAULT_MARKUP_RATE;

    return totalCost;
  }

  /**
   * 扣除用户余额（从 KV）
   */
  async deductBalance(userId: string, cost: number): Promise<void> {
    await this.kvService.deductBalance(userId, cost);
  }

  /**
   * 记录使用日志（写入 D1）
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
   * 处理完整的计费流程（计算 + KV扣费 + D1记录日志）
   */
  async processUsage(
    userId: string,
    apiKeyId: string | null,
    usage: UsageInfo
  ): Promise<number> {
    const cost = this.calculateCost(
      usage.model,
      usage.inputTokens,
      usage.outputTokens
    );

    // KV 扣款
    await this.deductBalance(userId, cost);

    // D1 记录日志
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
