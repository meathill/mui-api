import { describe, expect, it } from 'vitest';
import type { GlobalConfig } from './alert-service';
import { BillingService } from './billing-service';
import type { KVService } from './kv-service';

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

function createMockKV(
  initialData: { balance: number; concurrency: number; freeQuotaUsed?: number },
  globalConfig: GlobalConfig | null,
) {
  let data = { ...initialData };

  return {
    data: () => data,
    service: {
      async deductBalance(_userId: string, amount: number) {
        data = { ...data, balance: Math.max(0, data.balance - amount) };
        return true;
      },
      async getGlobalConfig() {
        return globalConfig;
      },
      async getUser() {
        return {
          data,
          metadata: {
            email: 'test@example.com',
            createdAt: '2026-04-29T00:00:00.000Z',
          },
        };
      },
      async consumeFreeQuota(_userId: string, amount: number) {
        data = { ...data, freeQuotaUsed: Math.max(0, (data.freeQuotaUsed ?? 0) + amount) };
        return data.freeQuotaUsed;
      },
      async setUser(_userId: string, nextData: typeof data) {
        data = { ...nextData };
      },
    } as unknown as KVService,
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
    it('should calculate cost for gpt-4o model', async () => {
      const service = new BillingService(null as never, mockDb as never);
      const cost = await service.calculateCost('gpt-4o', 1000, 500);

      // gpt-4o: input $2.5/1M, output $10/1M, markup 1.2
      // (1000/1M * 2.5 + 500/1M * 10) * 1.2
      // = (0.0025 + 0.005) * 1.2
      // = 0.009
      expect(cost).toBeCloseTo(0.009, 5);
    });

    it('should calculate cost for gpt-4o-mini model', async () => {
      const service = new BillingService(null as never, mockDb as never);
      const cost = await service.calculateCost('gpt-4o-mini', 10000, 5000);

      // gpt-4o-mini: input $0.15/1M, output $0.6/1M, markup 1.2
      // (10000/1M * 0.15 + 5000/1M * 0.6) * 1.2
      // = (0.0015 + 0.003) * 1.2
      // = 0.0054
      expect(cost).toBeCloseTo(0.0054, 5);
    });

    it('should use default pricing for unknown models', async () => {
      const service = new BillingService(null as never, mockDb as never);
      const cost = await service.calculateCost('unknown-model', 1000, 500);

      // Falls back to gpt-4o-mini pricing
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('processUsage free quota', () => {
    it('白名单模型先抵扣免费额度，不扣余额', async () => {
      const kv = createMockKV(
        { balance: 1, concurrency: 0, freeQuotaUsed: 0.25 },
        createGlobalConfig(['mimo-v2.5-pro']),
      );
      const service = new BillingService(kv.service, mockDb as never);

      const result = await service.processUsage(
        'user-1',
        'key-1',
        { model: 'mimo-v2.5-pro', inputTokens: 500_000, outputTokens: 0 },
        { inputPrice: 1, outputPrice: 0, markupRate: 1 },
        1,
        { useFreeQuota: true },
      );

      expect(result.totalCost).toBeCloseTo(0.5, 5);
      expect(result.freeQuotaDeducted).toBeCloseTo(0.5, 5);
      expect(result.chargedCost).toBe(0);
      expect(kv.data().balance).toBe(1);
      expect(kv.data().freeQuotaUsed).toBeCloseTo(0.75, 5);
    });

    it('免费额度不足时只扣除剩余部分', async () => {
      const kv = createMockKV(
        { balance: 1, concurrency: 0, freeQuotaUsed: 0.9 },
        createGlobalConfig(['mimo-v2.5-pro']),
      );
      const service = new BillingService(kv.service, mockDb as never);

      const result = await service.processUsage(
        'user-1',
        'key-1',
        { model: 'mimo-v2.5-pro', inputTokens: 500_000, outputTokens: 0 },
        { inputPrice: 1, outputPrice: 0, markupRate: 1 },
        1,
        { useFreeQuota: true },
      );

      expect(result.freeQuotaDeducted).toBeCloseTo(0.1, 5);
      expect(result.chargedCost).toBeCloseTo(0.4, 5);
      expect(kv.data().balance).toBeCloseTo(0.6, 5);
      expect(kv.data().freeQuotaUsed).toBe(1);
    });

    it('非白名单模型不使用免费额度', async () => {
      const kv = createMockKV({ balance: 1, concurrency: 0, freeQuotaUsed: 0 }, createGlobalConfig(['mimo-v2.5-pro']));
      const service = new BillingService(kv.service, mockDb as never);

      const result = await service.processUsage(
        'user-1',
        'key-1',
        { model: 'gpt-4o', inputTokens: 500_000, outputTokens: 0 },
        { inputPrice: 1, outputPrice: 0, markupRate: 1 },
        1,
        { useFreeQuota: true },
      );

      expect(result.freeQuotaDeducted).toBe(0);
      expect(result.chargedCost).toBeCloseTo(0.5, 5);
      expect(kv.data().balance).toBeCloseTo(0.5, 5);
      expect(kv.data().freeQuotaUsed).toBe(0);
    });
  });
});
