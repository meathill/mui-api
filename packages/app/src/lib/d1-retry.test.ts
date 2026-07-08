// 实现已上移到 @muirouter/shared-db/d1-retry；测试保留在 app 包运行，因为 shared-db 无独立测试基建。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeD1RetryDelayMs, isRetryableD1Error, withD1Retry } from '@muirouter/shared-db/d1-retry';

describe('isRetryableD1Error', () => {
  it.each([
    'D1 DB is overloaded. Requests queued for too long.',
    'internal error',
    'Network connection lost.',
    'D1_ERROR: Network connection lost.',
    'request timeout',
  ])('白名单命中时可重试：%s', (message) => {
    expect(isRetryableD1Error(new Error(message))).toBe(true);
  });

  it.each([
    'UNIQUE constraint failed: verification.id',
    'NOT NULL constraint failed: user.email',
    'FOREIGN KEY constraint failed',
    'no such table: foo',
    'no such column: bar',
    'SQLITE_ERROR: syntax error near "SELCT"',
  ])('黑名单命中时不可重试：%s', (message) => {
    expect(isRetryableD1Error(new Error(message))).toBe(false);
  });

  it('黑名单优先于白名单', () => {
    expect(isRetryableD1Error(new Error('network timeout: UNIQUE constraint failed'))).toBe(false);
  });

  it('未识别的错误默认不重试', () => {
    expect(isRetryableD1Error(new Error('something unexpected happened'))).toBe(false);
  });

  it('非 Error 抛出值也能正常处理', () => {
    expect(isRetryableD1Error('overloaded')).toBe(true);
    expect(isRetryableD1Error(undefined)).toBe(false);
  });
});

describe('computeD1RetryDelayMs', () => {
  it('第一次重试延迟落在 [base/2, base] 区间', () => {
    for (let i = 0; i < 20; i++) {
      const delay = computeD1RetryDelayMs(1, 100, 800);
      expect(delay).toBeGreaterThanOrEqual(50);
      expect(delay).toBeLessThanOrEqual(100);
    }
  });

  it('第二次重试的区间大致是第一次的两倍', () => {
    for (let i = 0; i < 20; i++) {
      const delay = computeD1RetryDelayMs(2, 100, 800);
      expect(delay).toBeGreaterThanOrEqual(100);
      expect(delay).toBeLessThanOrEqual(200);
    }
  });

  it('不会超过 maxDelayMs，即使 attempt 很大', () => {
    for (let i = 0; i < 20; i++) {
      const delay = computeD1RetryDelayMs(10, 100, 800);
      expect(delay).toBeLessThanOrEqual(800);
    }
  });
});

interface MockStatementOverrides {
  run?: ReturnType<typeof vi.fn>;
  all?: ReturnType<typeof vi.fn>;
  raw?: ReturnType<typeof vi.fn>;
  first?: ReturnType<typeof vi.fn>;
}

function createMockStatement(overrides: MockStatementOverrides = {}) {
  const statement = {
    bind: vi.fn(() => statement),
    run: overrides.run ?? vi.fn(),
    all: overrides.all ?? vi.fn(),
    raw: overrides.raw ?? vi.fn(),
    first: overrides.first ?? vi.fn(),
  };
  return statement;
}

describe('withD1Retry', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('前几次失败、最后成功时会重试并最终 resolve', async () => {
    vi.useFakeTimers();
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('D1 DB is overloaded. Requests queued for too long.'))
      .mockRejectedValueOnce(new Error('internal error'))
      .mockResolvedValueOnce({ success: true });
    const realStatement = createMockStatement({ run });
    const d1 = { prepare: vi.fn(() => realStatement) } as unknown as D1Database;

    const wrapped = withD1Retry(d1, { baseDelayMs: 10, maxDelayMs: 40 });
    const promise = wrapped.prepare('select 1').run();
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ success: true });
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('不可重试错误立即 reject，不会多次调用', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('UNIQUE constraint failed: verification.id'));
    const realStatement = createMockStatement({ run });
    const d1 = { prepare: vi.fn(() => realStatement) } as unknown as D1Database;

    const wrapped = withD1Retry(d1);
    await expect(wrapped.prepare('insert into verification ...').run()).rejects.toThrow(
      'UNIQUE constraint failed: verification.id',
    );
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('超过重试预算后 rethrow 最后一次的错误', async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockRejectedValue(new Error('network timeout'));
    const realStatement = createMockStatement({ run });
    const d1 = { prepare: vi.fn(() => realStatement) } as unknown as D1Database;

    const wrapped = withD1Retry(d1, { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 20 });
    const promise = wrapped.prepare('select 1').run();
    promise.catch(() => {});
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('network timeout');
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('bind 会链式传递参数，重试作用在绑定后的语句上', async () => {
    const run = vi.fn().mockResolvedValueOnce({ success: true });
    const realStatement = createMockStatement({ run });
    const d1 = { prepare: vi.fn(() => realStatement) } as unknown as D1Database;

    const wrapped = withD1Retry(d1);
    await wrapped.prepare('insert into foo values (?, ?)').bind('a', 'b').run();

    expect(realStatement.bind).toHaveBeenCalledWith('a', 'b');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('batch 会反解出真实 statement 再传给底层 d1.batch()', async () => {
    const realStatementA = createMockStatement();
    const realStatementB = createMockStatement();
    const batch = vi.fn().mockResolvedValueOnce([{ success: true }, { success: true }]);
    const d1 = {
      prepare: vi.fn((sql: string) => (sql === 'a' ? realStatementA : realStatementB)),
      batch,
    } as unknown as D1Database;

    const wrapped = withD1Retry(d1);
    const wrappedA = wrapped.prepare('a');
    const wrappedB = wrapped.prepare('b');
    await wrapped.batch([wrappedA, wrappedB]);

    expect(batch).toHaveBeenCalledWith([realStatementA, realStatementB]);
  });

  it('all 失败后重试成功', async () => {
    vi.useFakeTimers();
    const all = vi.fn().mockRejectedValueOnce(new Error('overloaded')).mockResolvedValueOnce({ results: [] });
    const realStatement = createMockStatement({ all });
    const d1 = { prepare: vi.fn(() => realStatement) } as unknown as D1Database;

    const wrapped = withD1Retry(d1, { baseDelayMs: 10, maxDelayMs: 20 });
    const promise = wrapped.prepare('select 1').all();
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual({ results: [] });
    expect(all).toHaveBeenCalledTimes(2);
  });

  it('raw 失败后重试成功', async () => {
    vi.useFakeTimers();
    const raw = vi.fn().mockRejectedValueOnce(new Error('overloaded')).mockResolvedValueOnce([]);
    const realStatement = createMockStatement({ raw });
    const d1 = { prepare: vi.fn(() => realStatement) } as unknown as D1Database;

    const wrapped = withD1Retry(d1, { baseDelayMs: 10, maxDelayMs: 20 });
    const promise = wrapped.prepare('select 1').raw();
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toEqual([]);
    expect(raw).toHaveBeenCalledTimes(2);
  });

  it('first 失败后重试成功', async () => {
    vi.useFakeTimers();
    const first = vi.fn().mockRejectedValueOnce(new Error('overloaded')).mockResolvedValueOnce(null);
    const realStatement = createMockStatement({ first });
    const d1 = { prepare: vi.fn(() => realStatement) } as unknown as D1Database;

    const wrapped = withD1Retry(d1, { baseDelayMs: 10, maxDelayMs: 20 });
    const promise = wrapped.prepare('select 1').first();
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBeNull();
    expect(first).toHaveBeenCalledTimes(2);
  });

  it('自定义 isRetryable / onAttemptFailure 会被使用', async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockRejectedValueOnce(new Error('some custom error')).mockResolvedValueOnce({ ok: true });
    const realStatement = createMockStatement({ run });
    const d1 = { prepare: vi.fn(() => realStatement) } as unknown as D1Database;
    const isRetryable = vi.fn(() => true);
    const onAttemptFailure = vi.fn();

    const wrapped = withD1Retry(d1, { baseDelayMs: 10, maxDelayMs: 20, isRetryable, onAttemptFailure });
    const promise = wrapped.prepare('select 1').run();
    await vi.runAllTimersAsync();
    await promise;

    expect(isRetryable).toHaveBeenCalled();
    expect(onAttemptFailure).toHaveBeenCalled();
  });
});
