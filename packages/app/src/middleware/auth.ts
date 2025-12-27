import type { Context, Next } from "hono";
import type { CloudflareBindings } from "../types";
import { createDb } from "../db";
import { KeyService } from "../services/key-service";
import { RechargeService } from "../services/recharge-service";

const MIN_BALANCE = 0.01;

/**
 * API Key 认证中间件
 * 验证 Bearer Token 并检查余额
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

  const apiKey = authHeader.substring(7); // Remove "Bearer "

  if (!apiKey.startsWith("sk-gw-")) {
    return c.json(
      { error: { message: "无效的 API Key 格式", type: "invalid_request_error" } },
      401
    );
  }

  const db = createDb(c.env.DB);
  const keyService = new KeyService(db);
  const rechargeService = new RechargeService(db);

  // 验证 API Key
  const userId = await keyService.validateApiKey(apiKey);
  if (!userId) {
    return c.json(
      { error: { message: "无效的 API Key", type: "invalid_api_key" } },
      401
    );
  }

  // 检查余额
  const balance = await rechargeService.getBalance(userId);
  if (balance < MIN_BALANCE) {
    return c.json(
      {
        error: {
          message: `余额不足，当前余额: $${balance.toFixed(4)}`,
          type: "insufficient_quota",
        },
      },
      402
    );
  }

  // 注入用户信息到 Context
  c.set("userId", userId);
  c.set("balance", balance);

  await next();
}
