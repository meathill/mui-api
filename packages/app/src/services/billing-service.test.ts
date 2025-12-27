import { describe, expect, it } from "vitest";
import { BillingService } from "./billing-service";

// Mock Database
const mockDb = {
  query: {
    models: {
      findFirst: async () => null,
    },
  },
  update: () => ({
    set: () => ({
      where: async () => { },
    }),
  }),
  insert: () => ({
    values: async () => { },
  }),
};

describe("BillingService", () => {
  describe("calculateCost", () => {
    it("should calculate cost for gpt-4o model", async () => {
      const service = new BillingService(mockDb as never);
      const cost = await service.calculateCost("gpt-4o", 1000, 500);

      // gpt-4o: input $2.5/1M, output $10/1M, markup 1.2
      // (1000/1M * 2.5 + 500/1M * 10) * 1.2
      // = (0.0025 + 0.005) * 1.2
      // = 0.009
      expect(cost).toBeCloseTo(0.009, 5);
    });

    it("should calculate cost for gpt-4o-mini model", async () => {
      const service = new BillingService(mockDb as never);
      const cost = await service.calculateCost("gpt-4o-mini", 10000, 5000);

      // gpt-4o-mini: input $0.15/1M, output $0.6/1M, markup 1.2
      // (10000/1M * 0.15 + 5000/1M * 0.6) * 1.2
      // = (0.0015 + 0.003) * 1.2
      // = 0.0054
      expect(cost).toBeCloseTo(0.0054, 5);
    });

    it("should use default pricing for unknown models", async () => {
      const service = new BillingService(mockDb as never);
      const cost = await service.calculateCost("unknown-model", 1000, 500);

      // Falls back to gpt-4o-mini pricing
      expect(cost).toBeGreaterThan(0);
    });
  });
});
