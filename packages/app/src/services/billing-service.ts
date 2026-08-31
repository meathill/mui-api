import { generateId } from '@muirouter/shared-db/crypto';
import type { Database } from '../db';
import { type NewUsageLog, usageLogs } from '../db/schema';
import type { FreeQuotaConfig } from '../types';
import type { KVService } from './kv-service';
import type { WalletService } from './wallet-service';

// grok 非法请求无 usage 时的兜底基准成本（上游侧），受 markupRate 与 userRateMultiplier 影响
export const GROK_NO_USAGE_BASE_COST = 0.01;

// 默认加价倍率
const DEFAULT_MARKUP_RATE = 1.2;

// 兜底定价（当 DB 中无配置且未传入 modelPricing 时）
const FALLBACK_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
};

export type BillingTier = 'standard' | 'long_context';

export interface UsageInfo {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  model: string;
}

export interface ModelPricing {
  inputPrice: number;
  outputPrice: number;
  markupRate: number;
  // cache 分档（null 视为未启用，回退 inputPrice）
  cachedInputPrice?: number | null;
  cacheWritePrice?: number | null;
  // 长上下文档位（任一字段缺失则回退对应的 standard 字段）
  longContextThresholdTokens?: number | null;
  longContextInputPrice?: number | null;
  longContextCachedInputPrice?: number | null;
  longContextCacheWritePrice?: number | null;
  longContextOutputPrice?: number | null;
}

export interface FreeQuotaState {
  enabled: boolean;
  eligible: boolean;
  amount: number;
  used: number;
  remaining: number;
  modelIds: string[];
}

export interface BillingOptions {
  useFreeQuota?: boolean;
}

export interface BillingResult {
  totalCost: number;
  chargedCost: number;
  freeQuotaDeducted: number;
  tier: BillingTier;
}

export interface CostBreakdown {
  cost: number;
  tier: BillingTier;
}

/**
 * 计费服务：计算费用、扣除余额（KV）、记录使用日志（D1）
 */
export class BillingService {
  constructor(
    private kvService: KVService,
    private db: Database,
    private walletService: WalletService,
  ) {}

  /**
   * 计算请求费用
   * 优先使用传入的 modelPricing（来自 DB models 表），否则使用兜底定价
   */
  calculateCost(usage: UsageInfo, modelPricing?: ModelPricing | null, userRateMultiplier = 1): CostBreakdown {
    const pricing = resolvePricing(usage.model, modelPricing);
    const contextSize = usage.inputTokens + usage.cachedInputTokens + usage.cacheWriteTokens;
    const isLongContext =
      pricing.longContextThresholdTokens != null &&
      pricing.longContextThresholdTokens > 0 &&
      contextSize > pricing.longContextThresholdTokens;

    const inputPrice = isLongContext ? (pricing.longContextInputPrice ?? pricing.inputPrice) : pricing.inputPrice;
    const cachedInputPrice = isLongContext
      ? (pricing.longContextCachedInputPrice ?? pricing.cachedInputPrice ?? inputPrice)
      : (pricing.cachedInputPrice ?? pricing.inputPrice);
    const cacheWritePrice = isLongContext
      ? (pricing.longContextCacheWritePrice ?? pricing.cacheWritePrice ?? inputPrice)
      : (pricing.cacheWritePrice ?? pricing.inputPrice);
    const outputPrice = isLongContext ? (pricing.longContextOutputPrice ?? pricing.outputPrice) : pricing.outputPrice;

    const rawCost =
      (usage.inputTokens * inputPrice +
        usage.cachedInputTokens * cachedInputPrice +
        usage.cacheWriteTokens * cacheWritePrice +
        usage.outputTokens * outputPrice) /
      1_000_000;
    const cost = rawCost * pricing.markupRate * userRateMultiplier;

    return { cost, tier: isLongContext ? 'long_context' : 'standard' };
  }

  /**
   * 扣除用户余额（从 KV）
   */
  async deductBalance(userId: string, cost: number): Promise<void> {
    await this.walletService.deduct(userId, cost);
  }

  /**
   * 查询用户对某个模型可用的免费额度状态
   */
  async getFreeQuotaState(userId: string, modelId: string): Promise<FreeQuotaState> {
    const [config, user] = await Promise.all([this.kvService.getGlobalConfig(), this.kvService.getUser(userId)]);
    const freeQuota = normalizeFreeQuotaConfig(config?.freeQuota);
    const used = Math.max(0, user.data?.freeQuotaUsed ?? 0);
    const remaining = freeQuota.enabled ? Math.max(0, freeQuota.amount - used) : 0;
    const eligible = freeQuota.enabled && freeQuota.amount > 0 && freeQuota.modelIds.includes(modelId);

    return {
      enabled: freeQuota.enabled,
      eligible,
      amount: freeQuota.amount,
      used,
      remaining,
      modelIds: freeQuota.modelIds,
    };
  }

  /**
   * 记录使用日志（写入 D1）
   */
  async logUsage(
    userId: string,
    apiKeyId: string | null,
    usage: UsageInfo,
    cost: number,
    tier: BillingTier,
  ): Promise<void> {
    const log: NewUsageLog = {
      id: generateId(),
      userId,
      apiKeyId,
      modelId: usage.model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      tier,
      cost,
    };

    await this.db.insert(usageLogs).values(log);
  }

  /**
   * 兜底计费：不依赖 token，直接按固定基准成本计费（用于 grok 非法请求无 usage 的场景）。
   * 语义：totalCost = baseCost * markupRate * userRateMultiplier，再走 freeQuota→扣余额→记日志。
   * 日志 token 全记 0，仅 cost 有值，解决“无 usage 导致无日志”问题。
   */
  async processFixedCost(
    userId: string,
    apiKeyId: string | null,
    modelId: string,
    baseCost: number,
    modelPricing?: ModelPricing | null,
    userRateMultiplier = 1,
    options: BillingOptions = {},
  ): Promise<BillingResult> {
    const markupRate = modelPricing?.markupRate ?? DEFAULT_MARKUP_RATE;
    const cost = baseCost * markupRate * userRateMultiplier;
    const tier: BillingTier = 'standard';
    const usage: UsageInfo = {
      model: modelId,
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0,
    };

    let freeQuotaDeducted = 0;
    if (options.useFreeQuota) {
      try {
        const freeQuota = await this.getFreeQuotaState(userId, modelId);
        if (freeQuota.eligible && freeQuota.remaining > 0) {
          freeQuotaDeducted = Math.min(cost, freeQuota.remaining);
          await this.walletService.consumeFreeQuota(userId, freeQuotaDeducted);
          console.log(
            `[billing] 免费额度抵扣: user=${userId} model=${modelId} deducted=${freeQuotaDeducted} remaining=${freeQuota.remaining - freeQuotaDeducted}`,
          );
        }
      } catch (e) {
        console.error(`[billing] 免费额度处理失败: user=${userId} model=${modelId} err=${String(e).slice(0, 500)}`, e);
      }
    }

    const chargedCost = Math.max(0, cost - freeQuotaDeducted);

    if (chargedCost > 0) {
      try {
        await this.deductBalance(userId, chargedCost);
        console.log(`[billing] 钱包扣费成功: user=${userId} charged=${chargedCost} total=${cost}`);
      } catch (e) {
        console.error(
          `[billing] 钱包扣费失败: user=${userId} charged=${chargedCost} err=${String(e).slice(0, 800)}`,
          e,
        );
        throw e;
      }
    } else {
      console.log(`[billing] 钱包无需扣费: user=${userId} total=${cost} freeDeducted=${freeQuotaDeducted}`);
    }

    try {
      await this.logUsage(userId, apiKeyId, usage, cost, tier);
      console.log(`[billing] D1 日志写入成功: user=${userId} model=${modelId} tier=${tier} cost=${cost}`);
    } catch (e) {
      console.error(
        `[billing] D1 日志写入失败: user=${userId} model=${modelId} cost=${cost} err=${String(e).slice(0, 1000)}`,
        e,
      );
      throw e;
    }

    return {
      totalCost: cost,
      chargedCost,
      freeQuotaDeducted,
      tier,
    };
  }

  /**
   * 处理完整的计费流程（计算 + KV扣费 + D1记录日志）
   */
  async processUsage(
    userId: string,
    apiKeyId: string | null,
    usage: UsageInfo,
    modelPricing?: ModelPricing | null,
    userRateMultiplier = 1,
    options: BillingOptions = {},
  ): Promise<BillingResult> {
    const { cost, tier } = this.calculateCost(usage, modelPricing, userRateMultiplier);

    let freeQuotaDeducted = 0;
    if (options.useFreeQuota) {
      try {
        const freeQuota = await this.getFreeQuotaState(userId, usage.model);
        if (freeQuota.eligible && freeQuota.remaining > 0) {
          freeQuotaDeducted = Math.min(cost, freeQuota.remaining);
          await this.walletService.consumeFreeQuota(userId, freeQuotaDeducted);
          console.log(
            `[billing] 免费额度抵扣: user=${userId} model=${usage.model} deducted=${freeQuotaDeducted} remaining=${freeQuota.remaining - freeQuotaDeducted}`,
          );
        }
      } catch (e) {
        console.error(
          `[billing] 免费额度处理失败: user=${userId} model=${usage.model} err=${String(e).slice(0, 500)}`,
          e,
        );
      }
    }

    const chargedCost = Math.max(0, cost - freeQuotaDeducted);

    // KV 扣款
    if (chargedCost > 0) {
      try {
        await this.deductBalance(userId, chargedCost);
        console.log(`[billing] 钱包扣费成功: user=${userId} charged=${chargedCost} total=${cost}`);
      } catch (e) {
        console.error(
          `[billing] 钱包扣费失败: user=${userId} charged=${chargedCost} err=${String(e).slice(0, 800)}`,
          e,
        );
        throw e;
      }
    } else {
      console.log(`[billing] 钱包无需扣费: user=${userId} total=${cost} freeDeducted=${freeQuotaDeducted}`);
    }

    // D1 记录日志
    try {
      await this.logUsage(userId, apiKeyId, usage, cost, tier);
      console.log(`[billing] D1 日志写入成功: user=${userId} model=${usage.model} tier=${tier} cost=${cost}`);
    } catch (e) {
      console.error(
        `[billing] D1 日志写入失败: user=${userId} model=${usage.model} cost=${cost} err=${String(e).slice(0, 1000)}`,
        e,
      );
      throw e;
    }

    return {
      totalCost: cost,
      chargedCost,
      freeQuotaDeducted,
      tier,
    };
  }
}

function resolvePricing(model: string, modelPricing: ModelPricing | null | undefined): ModelPricing {
  if (modelPricing) return modelPricing;
  const fallback = FALLBACK_PRICING[model];
  if (!fallback) {
    console.warn(
      `[billing] 定价缺失: 模型 ${model} 无定价配置，使用 gpt-4o-mini 兜底 (0.15/0.6) —— 若为 Grok/Claude/DeepSeek 请检查 models 表是否缺行或 KV models:catalog 缓存过期`,
    );
  }
  const pricing = fallback ?? FALLBACK_PRICING['gpt-4o-mini'];
  return {
    inputPrice: pricing.input,
    outputPrice: pricing.output,
    markupRate: DEFAULT_MARKUP_RATE,
  };
}

function normalizeFreeQuotaConfig(config: FreeQuotaConfig | undefined): FreeQuotaConfig {
  if (!config) {
    return { enabled: false, amount: 0, modelIds: [] };
  }

  return {
    enabled: config.enabled === true,
    amount: Math.max(0, Number(config.amount) || 0),
    modelIds: Array.from(
      new Set((Array.isArray(config.modelIds) ? config.modelIds : []).map((id) => id.trim()).filter(Boolean)),
    ),
  };
}
