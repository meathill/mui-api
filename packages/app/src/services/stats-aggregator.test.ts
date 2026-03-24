import { describe, expect, it, vi } from 'vitest';
import { aggregateHourly, aggregateDaily, aggregateWeekly, aggregateMonthly } from './stats-aggregator';

/**
 * 创建 mock DB，模拟 drizzle ORM 的链式调用
 *
 * drizzle 的链式调用模式：
 * db.select({...}).from(table).where(condition) → Promise<Row[]>
 * db.select({...}).from(table).where(condition).groupBy(col) → Promise<Row[]>
 * db.select({...}).from(table).where(condition).limit(n) → Promise<Row[]>
 * db.insert(table).values({...}) → Promise<void>
 * db.update(table).set({...}).where(condition) → Promise<void>
 */
function createMockDb(resultQueue: Array<unknown[]>) {
  let callIndex = 0;

  function nextResult(): unknown[] {
    const result = resultQueue[callIndex] ?? [];
    callIndex++;
    return result;
  }

  // 创建一个 thenable 的链式代理，每次终结操作消耗一个 result
  function createChain(): Record<string, unknown> {
    let resolved = false;
    let resolvedValue: unknown[] = [];

    const chain: Record<string, unknown> = {};

    // 终结方法（返回 Promise）
    const resolve = () => {
      if (!resolved) {
        resolvedValue = nextResult();
        resolved = true;
      }
      return resolvedValue;
    };

    // 链式方法
    for (const method of ['from', 'where', 'groupBy', 'orderBy']) {
      chain[method] = vi.fn(() => chain);
    }

    // limit 是终结方法
    chain.limit = vi.fn(() => resolve());

    // 支持 await（then/catch）
    chain.then = (onFulfill: (v: unknown) => unknown, onReject?: (e: unknown) => unknown) => {
      try {
        return Promise.resolve(resolve()).then(onFulfill, onReject);
      } catch (e) {
        if (onReject) return Promise.resolve(onReject(e));
        return Promise.reject(e);
      }
    };
    chain.catch = (onReject: (e: unknown) => unknown) => {
      return Promise.resolve(resolve()).catch(onReject);
    };

    return chain;
  }

  const insertFn = vi.fn();
  const updateFn = vi.fn();

  return {
    select: vi.fn(() => createChain()),
    insert: vi.fn(() => ({
      values: insertFn.mockResolvedValue(undefined),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: updateFn.mockResolvedValue(undefined),
      })),
    })),
    _insertFn: insertFn,
    _updateFn: updateFn,
  };
}

describe('StatsAggregator', () => {
  describe('aggregateHourly', () => {
    it('无数据时应跳过写入', async () => {
      const db = createMockDb([
        // aggregateFromLogs - 全局 select
        [{ totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, requestCount: 0 }],
        // aggregateFromLogs - 按用户
        [],
        // aggregateFromLogs - 按模型
        [],
      ]);

      await aggregateHourly(db as never);

      expect(db.insert).not.toHaveBeenCalled();
    });

    it('有数据时应执行聚合并写入', async () => {
      const db = createMockDb([
        // aggregateFromLogs - 全局
        [{ totalCost: 1.5, totalInputTokens: 10000, totalOutputTokens: 5000, requestCount: 3 }],
        // aggregateFromLogs - 按用户
        [
          { userId: 'user-1', totalCost: 1.0, totalInputTokens: 7000, totalOutputTokens: 3000, requestCount: 2 },
          { userId: 'user-2', totalCost: 0.5, totalInputTokens: 3000, totalOutputTokens: 2000, requestCount: 1 },
        ],
        // aggregateFromLogs - 按模型
        [{ modelId: 'gpt-4o', totalCost: 1.5, totalInputTokens: 10000, totalOutputTokens: 5000, requestCount: 3 }],
        // upsertStats - select existing for each row (4 rows: global + 2 users + 1 model)
        [], // 全局 - 不存在
        [], // user-1 - 不存在
        [], // user-2 - 不存在
        [], // gpt-4o - 不存在
      ]);

      await aggregateHourly(db as never);

      // 应插入 4 行
      expect(db.insert).toHaveBeenCalledTimes(4);
    });

    it('已有记录时应更新而非插入', async () => {
      const db = createMockDb([
        // aggregateFromLogs - 全局
        [{ totalCost: 2.0, totalInputTokens: 20000, totalOutputTokens: 10000, requestCount: 5 }],
        // aggregateFromLogs - 按用户
        [],
        // aggregateFromLogs - 按模型
        [],
        // upsertStats - select existing: 找到已有行
        [{ id: 'existing-id' }],
      ]);

      await aggregateHourly(db as never);

      // 应更新而非插入
      expect(db.update).toHaveBeenCalledTimes(1);
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe('aggregateDaily', () => {
    it('有 hourly 数据时应从 stats 聚合', async () => {
      const db = createMockDb([
        // aggregateFromStats - 检查 hourly 数据 count
        [{ cnt: 3 }],
        // aggregateFromStats - 全局聚合
        [{ totalCost: 5.0, totalInputTokens: 50000, totalOutputTokens: 25000, requestCount: 10 }],
        // aggregateFromStats - 按用户
        [],
        // aggregateFromStats - 按模型
        [],
        // upsertStats - select existing
        [],
      ]);

      await aggregateDaily(db as never);

      expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it('无 hourly 数据时应回退到 usage_logs', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const db = createMockDb([
        // aggregateFromStats - 检查 hourly 数据 count
        [{ cnt: 0 }],
        // aggregateFromLogs（回退）- 全局
        [{ totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, requestCount: 0 }],
        // 按用户
        [],
        // 按模型
        [],
      ]);

      await aggregateDaily(db as never);

      const logMsgs = consoleSpy.mock.calls.map((c) => String(c[0]));
      expect(logMsgs.some((m) => m.includes('回退到 usage_logs'))).toBe(true);
      expect(db.insert).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('aggregateWeekly', () => {
    it('周聚合时间范围应为 7 天', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const db = createMockDb([
        [{ cnt: 0 }],
        [{ totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, requestCount: 0 }],
        [],
        [],
      ]);

      await aggregateWeekly(db as never);

      const logCall = consoleSpy.mock.calls.find((c) => String(c[0]).includes('周聚合:'));
      expect(logCall).toBeDefined();

      const dates = String(logCall![0]).match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z)/g);
      expect(dates).toHaveLength(2);

      const diffDays = (new Date(dates![1]).getTime() - new Date(dates![0]).getTime()) / (86400 * 1000);
      expect(diffDays).toBe(7);

      consoleSpy.mockRestore();
    });
  });

  describe('aggregateMonthly', () => {
    it('月聚合时间范围应为上一个完整月', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const db = createMockDb([
        [{ cnt: 0 }],
        [{ totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, requestCount: 0 }],
        [],
        [],
      ]);

      await aggregateMonthly(db as never);

      const logCall = consoleSpy.mock.calls.find((c) => String(c[0]).includes('月聚合:'));
      expect(logCall).toBeDefined();

      const dates = String(logCall![0]).match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z)/g);
      expect(dates).toHaveLength(2);

      const start = new Date(dates![0]);
      const end = new Date(dates![1]);

      // 都应是某月1号
      expect(start.getUTCDate()).toBe(1);
      expect(end.getUTCDate()).toBe(1);
      // end 比 start 晚一个月
      const monthDiff = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
      expect(monthDiff).toBe(1);

      consoleSpy.mockRestore();
    });
  });
});
