import type { Database } from '../db';
import { usageLogs, type NewUsageLog } from '../db/schema';
import { generateId } from '../lib/crypto';
import type { KVService } from './kv-service';

// 默认加价倍率
const DEFAULT_MARKUP_RATE = 1.2;

// 兜底定价（当 DB 中无配置且未传入 modelPricing 时）
const FALLBACK_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
};

export interface UsageInfo {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface ModelPricing {
  inputPrice: number;
  outputPrice: number;
  markupRate: number;
}

/**
 * 计费服务：计算费用、扣除余额（KV）、记录使用日志（D1）
 */
export class BillingService {
  constructor(
    private kvService: KVService,
    private db: Database,
  ) {}

  /**
   * 计算请求费用
   * 优先使用传入的 modelPricing（来自 DB models 表），否则使用兜底定价
   */
  calculateCost(model: string, inputTokens: number, outputTokens: number, modelPricing?: ModelPricing | null): number {
    let inputPrice: number;
    let outputPrice: number;
    let markupRate: number;

    if (modelPricing) {
      inputPrice = modelPricing.inputPrice;
      outputPrice = modelPricing.outputPrice;
      markupRate = modelPricing.markupRate;
    } else {
      const fallback = FALLBACK_PRICING[model];
      if (!fallback) {
        console.warn(`模型 ${model} 无定价配置，使用 gpt-4o-mini 兜底`);
      }
      const pricing = fallback ?? FALLBACK_PRICING['gpt-4o-mini'];
      inputPrice = pricing.input;
      outputPrice = pricing.output;
      markupRate = DEFAULT_MARKUP_RATE;
    }

    const inputCost = (inputTokens / 1_000_000) * inputPrice;
    const outputCost = (outputTokens / 1_000_000) * outputPrice;
    const totalCost = (inputCost + outputCost) * markupRate;

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
    cost: number,
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
    usage: UsageInfo,
    modelPricing?: ModelPricing | null,
  ): Promise<number> {
    const cost = this.calculateCost(usage.model, usage.inputTokens, usage.outputTokens, modelPricing);

    // KV 扣款
    await this.deductBalance(userId, cost);

    // D1 记录日志
    await this.logUsage(userId, apiKeyId, usage.model, usage.inputTokens, usage.outputTokens, cost);

    return cost;
  }
}
