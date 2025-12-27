import type { Context, Next } from "hono";
import type { CloudflareBindings } from "../types";
import { KVService } from "../services/kv-service";

const MIN_BALANCE = 0.01;

/**
 * API Key 认证 + 并发控制中间件
 */
export async function authMiddleware(
  c: Context<{ Bindings: CloudflareBindings }>,
  next: Next
) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      { error: { message: "缺少 Authorization header", type: "invalid_request_error" } },
      401
    );
  }

  const apiKey = authHeader.substring(7);

  if (!apiKey.startsWith("sk-gw-")) {
    return c.json(
      { error: { message: "无效的 API Key 格式", type: "invalid_request_error" } },
      401
    );
  }

  const defaultMaxConcurrency = Number(c.env.DEFAULT_MAX_CONCURRENCY) || 3;
  const kvService = new KVService(c.env.KV, defaultMaxConcurrency);

  // 验证 API Key
  const userId = await kvService.validateApiKey(apiKey);
  if (!userId) {
    return c.json(
      { error: { message: "无效的 API Key", type: "invalid_api_key" } },
      401
    );
  }

  // 获取用户数据
  const { data } = await kvService.getUser(userId);
  if (!data) {
    return c.json(
      { error: { message: "用户不存在", type: "invalid_api_key" } },
      401
    );
  }

  // 检查余额
  if (data.balance < MIN_BALANCE) {
    return c.json(
      {
        error: {
          message: `余额不足，当前余额: $${data.balance.toFixed(4)}`,
          type: "insufficient_quota",
        },
      },
      402
    );
  }

  // 检查并发
  const acquired = await kvService.acquireConcurrency(userId);
  if (!acquired) {
    const maxConcurrency = await kvService.getMaxConcurrency(userId);
    return c.json(
      {
        error: {
          message: `并发请求超限，最大允许 ${maxConcurrency} 个并发请求`,
          type: "rate_limit_exceeded",
        },
      },
      429
    );
  }

  // 注入用户信息
  c.set("userId", userId);
  c.set("balance", data.balance);

  try {
    await next();
  } finally {
    // 请求完成后释放并发槽位（使用 waitUntil 异步执行）
    c.executionCtx.waitUntil(kvService.releaseConcurrency(userId));
  }
}
