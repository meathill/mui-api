import type { Context, Next } from 'hono';
import type { CloudflareBindings } from '../types';
import { KVService } from '../services/kv-service';

// spec §2 规定的错误体格式
function spec401(c: Context, message = 'API key 无效或已被撤销') {
  return c.json({ error: 'invalid_api_key', message }, 401);
}

/**
 * 只读鉴权中间件：
 * - 仅校验 API Key 合法性，注入 userId
 * - 不抢并发 lease、不做最小余额拦截
 * - 错误体严格按 muirouter-spec.md §2
 *
 * 适用于纯查询类端点 (/v1/balance, /v1/usage, /v1/recharges,
 * /v1/topup-sessions, /v1/models) 与 MCP server。
 */
export async function readAuthMiddleware(c: Context<{ Bindings: CloudflareBindings }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return spec401(c, '缺少 Authorization header');
  }
  const apiKey = authHeader.substring(7).trim();
  if (!apiKey.startsWith('sk-gw-')) {
    return spec401(c);
  }
  const kv = new KVService(c.env.KV);
  const result = await kv.validateApiKey(apiKey);
  if (!result) {
    return spec401(c);
  }
  c.set('userId', result.userId);
  c.set('apiKeyId', result.keyHash);
  await next();
}
