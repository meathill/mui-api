import { describe, expect, it } from 'vitest';
import type { GlobalConfig } from './alert-service';
import { BillingService, GROK_NO_USAGE_BASE_COST, type ModelPricing, type UsageInfo } from './billing-service';
import type { KVService } from './kv-service';
import type { WalletService } from './wallet-service';

// Mock Database
const mockDb = {
  query: {
    models: {
      findFirst: async () => null,
    },
  },
  update: () => ({
    set: () => ({
      where: async () => {},
    }),
  }),
  insert: () => ({
    values: async () => {},
  }),
};

function makeUsage(partial: Partial<UsageInfo> & { model: string }): UsageInfo {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    ...partial,
  };
}

function createMockServices(
  initialData: { balance: number; concurrency: number; freeQuotaUsed?: number },
  globalConfig: GlobalConfig | null,
) {
  let data = { ...initialData };
  const metadata = { email: 'test@example.com', createdAt: '2026-04-29T00:00:00.000Z' };

  return {
    data: () => data,
    kvService: {
      async getGlobalConfig() {
        return globalConfig;
      },
      async getUser() {
        return { data, metadata };
      },
    } as unknown as KVService,
    walletService: {
      async deduct(_userId: string, amount: number) {
        data = { ...data, balance: Math.max(0, data.balance - amount) };
        return { data, metadata };
      },
      async consumeFreeQuota(_userId: string, amount: number) {
        data = { ...data, freeQuotaUsed: Math.max(0, (data.freeQuotaUsed ?? 0) + amount) };
        return { data, metadata };
      },
    } as unknown as WalletService,
  };
}

function createGlobalConfig(modelIds: string[]): GlobalConfig {
  return {
    dailySpendingCap: 0,
    monthlySpendingCap: 0,
    adminEmail: 'admin@example.com',
    isServicePaused: false,
    freeQuota: {
      enabled: true,
      amount: 1,
      modelIds,
    },
  };
}

describe('BillingService', () => {
  describe('calculateCost', () => {
    it('兜底定价：gpt-4o 无 cache 无 tier', () => {
      const service = new BillingService(null as never, mockDb as never, null as never);
      const { cost, tier } = service.calculateCost(
        makeUsage({ model: 'gpt-4o', inputTokens: 1000, outputTokens: 500 }),
      );
      // (1000/1M * 2.5 + 500/1M * 10) * 1.2 = 0.009
      expect(cost).toBeCloseTo(0.009, 5);
      expect(tier).toBe('standard');
    });

    it('兜底定价：gpt-4o-mini', () => {
      const service = new BillingService(null as never, mockDb as never, null as never);
      const { cost, tier } = service.calculateCost(
        makeUsage({ model: 'gpt-4o-mini', inputTokens: 10000, outputTokens: 5000 }),
      );
      // (10000/1M * 0.15 + 5000/1M * 0.6) * 1.2 = 0.0054
      expect(cost).toBeCloseTo(0.0054, 5);
      expect(tier).toBe('standard');
    });

    it('未知模型回退 gpt-4o-mini 兜底', () => {
      const service = new BillingService(null as never, mockDb as never, null as never);
      const { cost } = service.calculateCost(
        makeUsage({ model: 'unknown-model', inputTokens: 1000, outputTokens: 500 }),
      );
      expect(cost).toBeGreaterThan(0);
    });

    it('service_tier fast 按上游 2× 计费', () => {
      const service = new BillingService(null as never, mockDb as never, null as never);
      const base = makeUsage({ model: 'gpt-6-astra', inputTokens: 100_000, outputTokens: 50_000 });
      const standard = service.calculateCost(base, { inputPrice: 10, outputPrice: 50, markupRate: 1 });
      const fast = service.calculateCost(makeUsage({ ...base, serviceTier: 'fast' }), {
        inputPrice: 10,
        outputPrice: 50,
        markupRate: 1,
      });
      expect(fast.cost).toBeCloseTo(standard.cost * 2, 8);
      expect(fast.tier).toBe('fast');
    });

    it('service_tier priority（fast 旧名）同样 2×', () => {
      const service = new BillingService(null as never, mockDb as never, null as never);
      const { cost, tier } = service.calculateCost(
        makeUsage({ model: 'gpt-5.6-sol', inputTokens: 1_000_000, serviceTier: 'priority' }),
        { inputPrice: 4, outputPrice: 20, markupRate: 1 },
      );
      // 1_000_000/1M * 4 * 2 = 8
      expect(cost).toBeCloseTo(8, 6);
      expect(tier).toBe('fast');
    });

    it('service_tier flex 按上游 0.5× 计费', () => {
      const service = new BillingService(null as never, mockDb as never, null as never);
      const { cost, tier } = service.calculateCost(
        makeUsage({ model: 'gpt-6-astra', inputTokens: 1_000_000, serviceTier: 'flex' }),
        { inputPrice: 10, outputPrice: 50, markupRate: 1 },
      );
      expect(cost).toBeCloseTo(5, 6);
      expect(tier).toBe('flex');
    });

    it('未映射的 service_tier（default/auto）按 1× 计', () => {
      const service = new BillingService(null as never, mockDb as never, null as never);
      for (const serviceTier of ['default', 'auto', 'scale', undefined]) {
        const { cost, tier } = service.calculateCost(
          makeUsage({ model: 'gpt-6-astra', inputTokens: 1_000_000, serviceTier }),
          { inputPrice: 10, outputPrice: 50, markupRate: 1 },
        );
        expect(cost).toBeCloseTo(10, 6);
        expect(tier).toBe('standard');
      }
    });

    it('fast 与长上下文档位叠加：long_context_fast', () => {
      const service = new BillingService(null as never, mockDb as never, null as never);
      const pricing: ModelPricing = {
        inputPrice: 10,
        outputPrice: 50,
        markupRate: 1,
        cachedInputPrice: 1,
        longContextThresholdTokens: 272_000,
        longContextInputPrice: 20,
        longContextCachedInputPrice: 2,
        longContextOutputPrice: 75,
      };
      // >272K 触发长上下文，fast 再 ×2：input 300K 非缓存走 20*2=40，output 100K 走 75*2=150
      const { cost, tier } = service.calculateCost(
        makeUsage({ model: 'gpt-6-astra', inputTokens: 300_000, outputTokens: 100_000, serviceTier: 'fast' }),
        pricing,
      );
      expect(cost).toBeCloseTo((300_000 / 1_000_000) * 40 + (100_000 / 1_000_000) * 150, 8);
      expect(tier).toBe('long_context_fast');
    });

    it('Grok 图片内部 token 继续应用 markup 与用户倍率', () => {
      const service = new BillingService(null as never, mockDb as never, null as never);
      const { cost } = service.calculateCost(
        makeUsage({ model: 'grok-imagine-image', outputTokens: 20_000 }),
        { inputPrice: 0, outputPrice: 1, markupRate: 1.05 },
        1.5,
      );
      expect(cost).toBeCloseTo(0.0315, 6);
    });

    it('cached_input_price 命中折扣', () => {
      const service = new BillingService(null as never, mockDb as never, null as never);
      const pricing: ModelPricing = {
        inputPrice: 10,
        outputPrice: 0,
        markupRate: 1,
        cachedInputPrice: 1, // 0.1x
      };
      const { cost } = service.calculateCost(
        makeUsage({ model: 'm', inputTokens: 1_000_000, cachedInputTokens: 1_000_000 }),
        pricing,
      );
      // 1_000_000/1M * 10 + 1_000_000/1M * 1 = 11
      expect(cost).toBeCloseTo(11, 5);
    });

    it('cachedInputPrice 为 null 时回退 inputPrice', () => {
      const service = new BillingService(null as never, mockDb as never, null as never);
      const pricing: ModelPricing = { inputPrice: 10, outputPrice: 0, markupRate: 1, cachedInputPrice: null };
      const { cost } = service.calculateCost(
        makeUsage({ model: 'm', inputTokens: 500_000, cachedInputTokens: 500_000 }),
        pricing,
      );
      // 两段都按 input 价：(500_000 + 500_000)/1M * 10 = 10
      expect(cost).toBeCloseTo(10, 5);
    });

    it('anthropic cache_write_price 命中加价', () => {
      const service = new BillingService(null as never, mockDb as never, null as never);
      const pricing: ModelPricing = {
        inputPrice: 10,
        outputPrice: 0,
        markupRate: 1,
        cachedInputPrice: 1,
        cacheWritePrice: 12.5, // 1.25x
      };
      const { cost } = service.calculateCost(
        makeUsage({ model: 'claude', inputTokens: 0, cacheWriteTokens: 1_000_000 }),
        pricing,
      );
      // 1_000_000/1M * 12.5 = 12.5
      expect(cost).toBeCloseTo(12.5, 5);
    });

    it('长上下文档位：跨阈值后切换 longContext 价', () => {
      const service = new BillingService(null as never, mockDb as never, null as never);
      const pricing: ModelPricing = {
        inputPrice: 2.5,
        outputPrice: 15,
        markupRate: 1,
        cachedInputPrice: 0.25,
        longContextThresholdTokens: 270_000,
        longContextInputPrice: 5,
        longContextCachedInputPrice: 0.5,
        longContextOutputPrice: 22.5,
      };
      const { cost, tier } = service.calculateCost(
        makeUsage({ model: 'gpt-5.4', inputTokens: 300_000, outputTokens: 100_000 }),
        pricing,
      );
      // 触发长上下文（300k > 270k）：input 300k * 5 + output 100k * 22.5 = 1.5 + 2.25 = 3.75
      expect(tier).toBe('long_context');
      expect(cost).toBeCloseTo(3.75, 5);
    });

    it('未跨阈值：使用 standard 价', () => {
      const service = new BillingService(null as never, mockDb as never, null as never);
      const pricing: ModelPricing = {
        inputPrice: 2.5,
        outputPrice: 15,
        markupRate: 1,
        longContextThresholdTokens: 270_000,
        longContextInputPrice: 5,
        longContextOutputPrice: 22.5,
      };
      const { cost, tier } = service.calculateCost(
        makeUsage({ model: 'gpt-5.4', inputTokens: 100_000, outputTokens: 50_000 }),
        pricing,
      );
      // 标准档：100k * 2.5 + 50k * 15 = 0.25 + 0.75 = 1.0
      expect(tier).toBe('standard');
      expect(cost).toBeCloseTo(1.0, 5);
    });

    it('长上下文 + cache：cached + write + output 都用长档价', () => {
      const service = new BillingService(null as never, mockDb as never, null as never);
      const pricing: ModelPricing = {
        inputPrice: 2.5,
        outputPrice: 15,
        markupRate: 1,
        cachedInputPrice: 0.25,
        cacheWritePrice: 3.125,
        longContextThresholdTokens: 270_000,
        longContextInputPrice: 5,
        longContextCachedInputPrice: 0.5,
        longContextCacheWritePrice: 6.25,
        longContextOutputPrice: 22.5,
      };
      const { cost, tier } = service.calculateCost(
        makeUsage({
          model: 'm',
          inputTokens: 200_000,
          cachedInputTokens: 100_000,
          cacheWriteTokens: 50_000,
          outputTokens: 10_000,
        }),
        pricing,
      );
      // contextSize = 350k > 270k → long_context
      // 200k*5 + 100k*0.5 + 50k*6.25 + 10k*22.5 (all /1M) = 1.0 + 0.05 + 0.3125 + 0.225 = 1.5875
      expect(tier).toBe('long_context');
      expect(cost).toBeCloseTo(1.5875, 5);
    });

    it('longContextThresholdTokens 为 null：永远 standard', () => {
      const service = new BillingService(null as never, mockDb as never, null as never);
      const pricing: ModelPricing = {
        inputPrice: 10,
        outputPrice: 0,
        markupRate: 1,
        longContextThresholdTokens: null,
      };
      const { tier } = service.calculateCost(makeUsage({ model: 'm', inputTokens: 10_000_000 }), pricing);
      expect(tier).toBe('standard');
    });
  });

  describe('processUsage free quota', () => {
    it('白名单模型先抵扣免费额度，不扣余额', async () => {
      const services = createMockServices(
        { balance: 1, concurrency: 0, freeQuotaUsed: 0.25 },
        createGlobalConfig(['mimo-v2.5-pro']),
      );
      const service = new BillingService(services.kvService, mockDb as never, services.walletService);

      const result = await service.processUsage(
        'user-1',
        'key-1',
        makeUsage({ model: 'mimo-v2.5-pro', inputTokens: 500_000 }),
        { inputPrice: 1, outputPrice: 0, markupRate: 1 },
        1,
        { useFreeQuota: true },
      );

      expect(result.totalCost).toBeCloseTo(0.5, 5);
      expect(result.freeQuotaDeducted).toBeCloseTo(0.5, 5);
      expect(result.chargedCost).toBe(0);
      expect(result.tier).toBe('standard');
      expect(services.data().balance).toBe(1);
      expect(services.data().freeQuotaUsed).toBeCloseTo(0.75, 5);
    });

    it('免费额度不足时只扣除剩余部分', async () => {
      const services = createMockServices(
        { balance: 1, concurrency: 0, freeQuotaUsed: 0.9 },
        createGlobalConfig(['mimo-v2.5-pro']),
      );
      const service = new BillingService(services.kvService, mockDb as never, services.walletService);

      const result = await service.processUsage(
        'user-1',
        'key-1',
        makeUsage({ model: 'mimo-v2.5-pro', inputTokens: 500_000 }),
        { inputPrice: 1, outputPrice: 0, markupRate: 1 },
        1,
        { useFreeQuota: true },
      );

      expect(result.freeQuotaDeducted).toBeCloseTo(0.1, 5);
      expect(result.chargedCost).toBeCloseTo(0.4, 5);
      expect(services.data().balance).toBeCloseTo(0.6, 5);
      expect(services.data().freeQuotaUsed).toBe(1);
    });

    it('非白名单模型不使用免费额度', async () => {
      const services = createMockServices(
        { balance: 1, concurrency: 0, freeQuotaUsed: 0 },
        createGlobalConfig(['mimo-v2.5-pro']),
      );
      const service = new BillingService(services.kvService, mockDb as never, services.walletService);

      const result = await service.processUsage(
        'user-1',
        'key-1',
        makeUsage({ model: 'gpt-4o', inputTokens: 500_000 }),
        { inputPrice: 1, outputPrice: 0, markupRate: 1 },
        1,
        { useFreeQuota: true },
      );

      expect(result.freeQuotaDeducted).toBe(0);
      expect(result.chargedCost).toBeCloseTo(0.5, 5);
      expect(services.data().balance).toBeCloseTo(0.5, 5);
      expect(services.data().freeQuotaUsed).toBe(0);
    });
  });

  describe('processFixedCost grok 无 usage 兜底', () => {
    it('按 $0.01 基准 * markup * multiplier 计费并记录 0 token 日志', async () => {
      const services = createMockServices({ balance: 1, concurrency: 0 }, null);
      const service = new BillingService(services.kvService, mockDb as never, services.walletService);

      const result = await service.processFixedCost(
        'user-1',
        'key-1',
        'grok-4.3',
        GROK_NO_USAGE_BASE_COST,
        { inputPrice: 1.25, outputPrice: 2.5, markupRate: 1 },
        1,
        { useFreeQuota: true },
      );

      expect(result.totalCost).toBeCloseTo(0.01, 6);
      expect(result.chargedCost).toBeCloseTo(0.01, 6);
      expect(result.tier).toBe('standard');
      expect(services.data().balance).toBeCloseTo(0.99, 6);
    });

    it('受 markup 与 userRateMultiplier 影响', async () => {
      const services = createMockServices({ balance: 10, concurrency: 0 }, null);
      const service = new BillingService(services.kvService, mockDb as never, services.walletService);

      const result = await service.processFixedCost(
        'user-1',
        'key-1',
        'grok-imagine-image',
        GROK_NO_USAGE_BASE_COST,
        { inputPrice: 0, outputPrice: 1, markupRate: 1.05 },
        1.5,
        { useFreeQuota: false },
      );

      // 0.01 * 1.05 * 1.5 = 0.01575
      expect(result.totalCost).toBeCloseTo(0.01575, 6);
      expect(services.data().balance).toBeCloseTo(9.98425, 6);
    });

    it('允许 freeQuota 抵扣兜底成本', async () => {
      const services = createMockServices(
        { balance: 1, concurrency: 0, freeQuotaUsed: 0 },
        createGlobalConfig(['grok-4.3']),
      );
      const service = new BillingService(services.kvService, mockDb as never, services.walletService);

      const result = await service.processFixedCost(
        'user-1',
        'key-1',
        'grok-4.3',
        GROK_NO_USAGE_BASE_COST,
        { inputPrice: 1.25, outputPrice: 2.5, markupRate: 1 },
        1,
        { useFreeQuota: true },
      );

      expect(result.freeQuotaDeducted).toBeCloseTo(0.01, 6);
      expect(result.chargedCost).toBe(0);
      expect(services.data().balance).toBe(1);
      expect(services.data().freeQuotaUsed).toBeCloseTo(0.01, 6);
    });

    it('freeQuota 不足时仅抵扣剩余并扣差额', async () => {
      const services = createMockServices(
        { balance: 1, concurrency: 0, freeQuotaUsed: 0.995 },
        createGlobalConfig(['grok-4.3']),
      );
      const service = new BillingService(services.kvService, mockDb as never, services.walletService);

      const result = await service.processFixedCost(
        'user-1',
        'key-1',
        'grok-4.3',
        GROK_NO_USAGE_BASE_COST,
        { inputPrice: 1.25, outputPrice: 2.5, markupRate: 1 },
        1,
        { useFreeQuota: true },
      );

      expect(result.freeQuotaDeducted).toBeCloseTo(0.005, 6);
      expect(result.chargedCost).toBeCloseTo(0.005, 6);
      expect(services.data().balance).toBeCloseTo(0.995, 6);
    });
  });
});
