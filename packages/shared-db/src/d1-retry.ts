// D1 瞬时过载重试。生产 D1 观测到过 "D1 DB is overloaded" / "internal error" 这类
// 瞬时性错误，重试几下通常就能恢复；但约束/schema 类错误是确定性的，重试没有意义，
// 必须直接抛出——尤其是 verification 表：INSERT 的 id 在第一次尝试前就已生成，
// 如果响应丢失导致误判为失败并重试，撞到的会是主键 UNIQUE 冲突，这个冲突本身
// 不能被当成"值得重试"，否则会在一个确定性错误上空转重试次数。
//
// 用白名单（而非黑名单）判断是否重试：只在错误信息匹配已知的瞬时性特征时才重试，
// 默认不重试。黑名单一旦漏掉某种没见过的确定性错误（比如某个约束报错的措辞），
// 就会对着一个必然失败的请求空转重试；白名单更保守，未知错误形态直接快速失败。
// D1_ERROR 前缀故意没有放进白名单——不确定它是不是所有 D1 错误（含确定性错误）
// 通用的前缀，贸然加入会让白名单退化成"D1 报错就重试"，失去白名单的保守性。

const DENYLIST_PATTERNS = [/constraint failed/i, /no such table/i, /no such column/i, /syntax error/i];

const ALLOWLIST_PATTERNS = [/overloaded/i, /internal error/i, /network/i, /timeout/i];

export function isRetryableD1Error(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (DENYLIST_PATTERNS.some((pattern) => pattern.test(message))) {
    return false;
  }
  return ALLOWLIST_PATTERNS.some((pattern) => pattern.test(message));
}

// Equal jitter 退避：区间下限是纯指数值的一半，避免多个并发请求撞过载后同步重试。
export function computeD1RetryDelayMs(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  return exponential / 2 + Math.random() * (exponential / 2);
}

export type D1RetryOperation = 'run' | 'all' | 'raw' | 'first' | 'batch';

export interface D1RetryAttemptFailure {
  op: D1RetryOperation;
  attempt: number;
  maxAttempts: number;
  error: unknown;
  willRetry: boolean;
  delayMs?: number;
}

export interface D1RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
  onAttemptFailure?: (event: D1RetryAttemptFailure) => void;
}

const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 100;
const DEFAULT_MAX_DELAY_MS = 800;

function defaultOnAttemptFailure(event: D1RetryAttemptFailure): void {
  // 只在还会重试时打日志：不重试的失败大多是正常的业务性错误（比如注册时邮箱重复
  // 撞了 UNIQUE），默认打印会变成噪音，交给上层业务自己的错误处理去记录。
  if (event.willRetry) {
    console.warn(
      `[d1-retry] ${event.op} 第 ${event.attempt}/${event.maxAttempts} 次失败，${event.delayMs}ms 后重试：`,
      event.error,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ResolvedD1RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  isRetryable: (error: unknown) => boolean;
  onAttemptFailure: (event: D1RetryAttemptFailure) => void;
}

async function withRetry<T>(
  op: D1RetryOperation,
  execute: () => Promise<T>,
  options: ResolvedD1RetryOptions,
): Promise<T> {
  let attempt = 1;
  for (;;) {
    try {
      return await execute();
    } catch (error) {
      const canRetry = attempt < options.maxAttempts && options.isRetryable(error);
      if (!canRetry) {
        options.onAttemptFailure({ op, attempt, maxAttempts: options.maxAttempts, error, willRetry: false });
        throw error;
      }
      const delayMs = computeD1RetryDelayMs(attempt, options.baseDelayMs, options.maxDelayMs);
      options.onAttemptFailure({ op, attempt, maxAttempts: options.maxAttempts, error, willRetry: true, delayMs });
      await sleep(delayMs);
      attempt += 1;
    }
  }
}

// 只包装 prepare/batch：drizzle-orm 的 D1 driver 也只用这两个方法访问传入的 D1 对象，
// D1Database 独有的 exec/withSession/dump 这里不需要、也不提供。
export function withD1Retry(d1: D1Database | D1DatabaseSession, options: D1RetryOptions = {}): D1DatabaseSession {
  const resolved: ResolvedD1RetryOptions = {
    maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    baseDelayMs: options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS,
    maxDelayMs: options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS,
    isRetryable: options.isRetryable ?? isRetryableD1Error,
    onAttemptFailure: options.onAttemptFailure ?? defaultOnAttemptFailure,
  };

  // batch() 必须把真实的 D1PreparedStatement 传给底层 d1.batch()，不能传我们包装出来的
  // 壳对象——这里记录 wrapped → real 的对应关系，batch 时反解回真实 statement。
  const realStatements = new WeakMap<D1PreparedStatement, D1PreparedStatement>();

  function wrapStatement(real: D1PreparedStatement): D1PreparedStatement {
    const wrapped = {
      bind(...values: unknown[]) {
        return wrapStatement(real.bind(...values));
      },
      first<T = Record<string, unknown>>(colName?: string) {
        return withRetry('first', () => (colName === undefined ? real.first<T>() : real.first<T>(colName)), resolved);
      },
      run<T = Record<string, unknown>>() {
        return withRetry('run', () => real.run<T>(), resolved);
      },
      all<T = Record<string, unknown>>() {
        return withRetry('all', () => real.all<T>(), resolved);
      },
      raw<T = unknown[]>(rawOptions?: { columnNames?: boolean }) {
        return withRetry('raw', () => real.raw<T>(rawOptions as { columnNames: true }), resolved);
      },
    } as unknown as D1PreparedStatement;
    realStatements.set(wrapped, real);
    return wrapped;
  }

  return {
    prepare(query: string) {
      return wrapStatement(d1.prepare(query));
    },
    batch<T = unknown>(statements: D1PreparedStatement[]) {
      const real = statements.map((statement) => realStatements.get(statement) ?? statement);
      return withRetry('batch', () => d1.batch<T>(real), resolved);
    },
  } as unknown as D1DatabaseSession;
}
