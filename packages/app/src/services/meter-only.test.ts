import { describe, expect, it, vi } from 'vitest';
import { BillingService } from './billing-service';
import { KVService } from './kv-service';
import { WalletService } from './wallet-service';

describe('只计量模式', () => {
  function createService() {
    const values = vi.fn().mockResolvedValue(undefined);
    const kv = new KVService({} as never);
    const wallet = new WalletService({} as never);
    const deduct = vi.spyOn(wallet, 'deduct').mockRejectedValue(new Error('不应扣款'));
    const consume = vi.spyOn(wallet, 'consumeFreeQuota').mockRejectedValue(new Error('不应抵扣'));
    const getUser = vi.spyOn(kv, 'getUser').mockRejectedValue(new Error('不应查余额'));
    const service = new BillingService(kv, { insert: () => ({ values }) } as never, wallet, {
      projectId: 'internal',
      billingMode: 'meter_only',
      defaults: {},
    });
    return { service, values, deduct, consume, getUser };
  }
  it('保留费用和缓存统计，跳过钱包与免费额度', async () => {
    const { service, values, deduct, consume, getUser } = createService();
    const result = await service.processUsage(
      'owner',
      'key',
      { model: 'test', inputTokens: 1000, outputTokens: 100, cachedInputTokens: 500, cacheWriteTokens: 0 },
      { inputPrice: 2, outputPrice: 10, cachedInputPrice: 1, markupRate: 1 },
      1,
      { useFreeQuota: true },
    );
    expect(result.totalCost).toBeCloseTo(0.0035);
    expect(result.chargedCost).toBe(0);
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'internal', chargedCost: 0, cachedInputTokens: 500, cost: 0.0035 }),
    );
    expect(deduct).not.toHaveBeenCalled();
    expect(consume).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });
  it('固定费用与缺失 usage 也不会丢日志或伪造 token', async () => {
    const { service, values, deduct } = createService();
    await service.processFixedCost('owner', 'key', 'image', 0.1);
    await service.logMissingUsage('owner', 'key', 'audio');
    expect(values).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cost: null,
        chargedCost: 0,
        inputTokens: null,
        outputTokens: null,
        usageStatus: 'missing',
      }),
    );
    expect(deduct).not.toHaveBeenCalled();
  });
});
