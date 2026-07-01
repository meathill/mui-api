import type { Context, Next } from 'hono';
import { validateBearer } from '../lib/bearer-validator';
import type { CloudflareBindings } from '../types';

// spec §2 规定的错误体格式
function spec401(c: Context, message = 'API key 无效或已被撤销') {
  return c.json({ error: 'invalid_api_key', message }, 401);
}

/**
 * 只读鉴权中间件：
 * - 校验 Bearer token（PAT sk-gw-* 或 OAuth access_token mr_at_*），注入 userId
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
  const result = await validateBearer(c.env, apiKey, c.get('db'));
  if (!result) {
    return spec401(c);
  }
  c.set('userId', result.userId);
  c.set('apiKeyId', result.keyHash);
  await next();
}
