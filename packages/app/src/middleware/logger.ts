import type { Context, Next } from "hono";

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
  const userAgent = c.req.header("User-Agent") || "-";

  console.log(`[${requestId}] --> ${method} ${path}`);

  try {
    await next();
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[${requestId}] <-- ${method} ${path} ERROR ${duration}ms`, error);
    throw error;
  }

  const duration = Date.now() - start;
  const status = c.res.status;

  // 根据状态码使用不同日志级别
  if (status >= 500) {
    console.error(`[${requestId}] <-- ${method} ${path} ${status} ${duration}ms`);
  } else if (status >= 400) {
    console.warn(`[${requestId}] <-- ${method} ${path} ${status} ${duration}ms`);
  } else {
    console.log(`[${requestId}] <-- ${method} ${path} ${status} ${duration}ms`);
  }
}

/**
 * 简化版日志函数，用于关键操作
 */
export function logOperation(
  operation: string,
  userId: string | null,
  details?: Record<string, unknown>
) {
  const timestamp = new Date().toISOString();
  console.log(
    JSON.stringify({
      timestamp,
      operation,
      userId,
      ...details,
    })
  );
}
