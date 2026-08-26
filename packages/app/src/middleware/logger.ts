import type { Context, Next } from 'hono';

/**
 * 请求日志中间件
 * 记录请求的基本信息和响应状态
 */
export async function loggerMiddleware(c: Context, next: Next) {
  const start = Date.now();
  const requestId = crypto.randomUUID().substring(0, 8);

  // 请求信息
  const method = c.req.method;
  const path = c.req.path;
  const cf = (c.req.raw as unknown as { cf?: Record<string, unknown> }).cf;
  const colo = (cf?.colo as string) ?? '-';
  const country = (cf?.country as string) ?? '-';
  const city = (cf?.city as string) ?? '-';
  const ray = c.req.header('cf-ray') ?? '-';
  const ip = c.req.header('cf-connecting-ip') ?? '-';

  console.log(`[${requestId}] --> ${method} ${path} colo=${colo} country=${country} city=${city} ip=${ip} ray=${ray}`);

  try {
    await next();
  } catch (error) {
    const duration = Date.now() - start;
    console.error(
      `[${requestId}] <-- ${method} ${path} ERROR ${duration}ms colo=${colo} country=${country} ray=${ray}`,
      error,
    );
    throw error;
  }

  const duration = Date.now() - start;
  const status = c.res.status;

  // 关键：让浏览器也能看到部署是否更新（Playground 不用看日志也能验证）
  c.header('x-mui-api-version', '2026-08-27T16:30:00Z-openai-direct-smart');
  c.header('x-mui-api-colo', colo);
  c.header('x-mui-api-country', country);

  // 根据状态码使用不同日志级别
  if (status >= 500) {
    console.error(`[${requestId}] <-- ${method} ${path} ${status} ${duration}ms colo=${colo} ray=${ray}`);
  } else if (status >= 400) {
    console.warn(`[${requestId}] <-- ${method} ${path} ${status} ${duration}ms colo=${colo} ray=${ray}`);
  } else {
    console.log(`[${requestId}] <-- ${method} ${path} ${status} ${duration}ms colo=${colo} ray=${ray}`);
  }
}

/**
 * 简化版日志函数，用于关键操作
 */
export function logOperation(operation: string, userId: string | null, details?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  console.log(
    JSON.stringify({
      timestamp,
      operation,
      userId,
      ...details,
    }),
  );
}
