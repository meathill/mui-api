import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as appSchema from '@/db/app-schema';
import * as authSchema from '@/db/schema';
import { getDb, logD1Failure } from './db';

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(),
}));

vi.mock('drizzle-orm/d1', () => ({
  drizzle: vi.fn((session: unknown, options: unknown) => ({ session, options })),
}));

interface SimpleMock {
  (...args: unknown[]): unknown;
  mock: { calls: unknown[][] };
  mockResolvedValue: (value: unknown) => void;
  mockReset: () => void;
  mockClear: () => void;
}

const getContextMock = getCloudflareContext as unknown as SimpleMock;
const drizzleMock = drizzle as unknown as SimpleMock;

interface FakeStatement {
  bind: (...args: unknown[]) => FakeStatement;
  first: () => Promise<unknown>;
}

function createFakeSession(first: () => Promise<unknown>) {
  const statement: FakeStatement = {
    bind: vi.fn(() => statement),
    first,
  };
  return { prepare: vi.fn(() => statement) };
}

describe('getDb', () => {
  afterEach(() => {
    vi.useRealTimers();
    getContextMock.mockReset();
    drizzleMock.mockClear();
  });

  it('用 first-unconstrained 打开 session，并把重试包装后的 session 与合并 schema 传给 drizzle', async () => {
    vi.useFakeTimers();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const first = vi.fn().mockRejectedValueOnce(new Error('overloaded')).mockResolvedValueOnce({ id: 1 });
    const rawSession = createFakeSession(first);
    const withSession = vi.fn(() => rawSession);
    getContextMock.mockResolvedValue({ env: { DB: { withSession } } });

    await getDb();

    expect(withSession).toHaveBeenCalledWith('first-unconstrained');
    expect(drizzleMock).toHaveBeenCalledTimes(1);
    const [wrappedSession, options] = drizzleMock.mock.calls[0] as [
      { prepare: (query: string) => FakeStatement },
      { schema: unknown },
    ];
    expect(options).toEqual({ schema: { ...authSchema, ...appSchema } });
    expect(wrappedSession).not.toBe(rawSession);

    // 验证传给 drizzle 的 session 确实被 withD1Retry 包了一层：可重试错误会自动重试成功
    const promise = wrappedSession.prepare('select 1').first();
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ id: 1 });
    expect(first).toHaveBeenCalledTimes(2);
    consoleErrorSpy.mockRestore();
  });
});

describe('logD1Failure', () => {
  it('记录单层错误的 causeChain 与是否可重试', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logD1Failure({
      op: 'run',
      attempt: 1,
      maxAttempts: 4,
      error: new Error('overloaded'),
      willRetry: true,
      delayMs: 100,
    });

    const payload = JSON.parse(spy.mock.calls[0][1] as string);
    expect(payload.causeChain).toEqual(['Error: overloaded']);
    expect(payload.wouldRetry).toBe(true);
    spy.mockRestore();
  });

  it('沿 cause 链逐层遍历', () => {
    const inner = new Error('inner');
    const outer = new Error('outer', { cause: inner });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logD1Failure({ op: 'first', attempt: 1, maxAttempts: 4, error: outer, willRetry: false });

    const payload = JSON.parse(spy.mock.calls[0][1] as string);
    expect(payload.causeChain).toEqual(['Error: outer', 'Error: inner']);
    spy.mockRestore();
  });

  it('cause 链超过 5 层时截断', () => {
    let error = new Error('level-0');
    for (let i = 1; i <= 6; i++) {
      error = new Error(`level-${i}`, { cause: error });
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logD1Failure({ op: 'all', attempt: 1, maxAttempts: 4, error, willRetry: false });

    const payload = JSON.parse(spy.mock.calls[0][1] as string);
    expect(payload.causeChain).toHaveLength(5);
    spy.mockRestore();
  });

  it('非 Error 类型的 error 也能正常处理，不抛异常', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      logD1Failure({ op: 'batch', attempt: 1, maxAttempts: 4, error: 'plain string error', willRetry: false }),
    ).not.toThrow();

    const payload = JSON.parse(spy.mock.calls[0][1] as string);
    expect(payload.causeChain).toEqual([]);
    expect(payload.wouldRetry).toBe(false);
    spy.mockRestore();
  });
});
