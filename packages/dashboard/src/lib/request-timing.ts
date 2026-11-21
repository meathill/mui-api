/**
 * 关键链路计时日志：配合 observability（Workers Logs）定位 OAuth → 控制台首屏的耗时分布（issue #22）。
 * 前缀风格与 packages/app 的 loggerMiddleware 保持一致，慢请求升级为 warn 方便过滤。
 */
const TIMING_PREFIX = '[dashboard-timing]';
const SLOW_THRESHOLD_MS = 3000;

export function logTiming(label: string, durationMs: number): void {
  const rounded = Math.round(durationMs);
  const line = `${TIMING_PREFIX} ${label} ${rounded}ms`;
  if (rounded >= SLOW_THRESHOLD_MS) {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export async function withTiming<T>(label: string, operation: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await operation();
  } finally {
    logTiming(label, performance.now() - start);
  }
}
