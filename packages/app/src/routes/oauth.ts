import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Database } from '../db';
import { users } from '../db/schema';
import {
  authenticateClient,
  consumeCodeAndIssueTokens,
  OauthError,
  revokeTokenPair,
  rotateRefreshToken,
} from '../services/oauth-token-service';
import type { CloudflareBindings } from '../types';

/**
 * OAuth 2.0 公开端点：token / revoke。
 *
 * 授权页（/oauth/authorize）住在 dashboard（Next.js）——它需要用户登录态 + consent UI，
 * 用 better-auth session 校验后，调内部接口写 oauth_codes 表。
 *
 * 这边 Hono Worker 只负责无状态的 token 颁发与撤销。
 *
 * 协议：见 muirouter-spec.md「§ OAuth 2.0」与 muicv 仓库 packages/shared/src/muirouter-oauth.ts。
 */

const oauth = new Hono<{ Bindings: CloudflareBindings }>();

type TokenBody = {
  grant_type?: unknown;
  code?: unknown;
  refresh_token?: unknown;
  redirect_uri?: unknown;
  client_id?: unknown;
  client_secret?: unknown;
};

oauth.post('/token', async (c) => {
  let body: TokenBody;
  try {
    body = (await c.req.json()) as TokenBody;
  } catch {
    return c.json({ error: 'invalid_request', error_description: '请求体不是合法 JSON' }, 400);
  }

  const grant = typeof body.grant_type === 'string' ? body.grant_type : '';
  const clientId = typeof body.client_id === 'string' ? body.client_id : '';
  const clientSecret = typeof body.client_secret === 'string' ? body.client_secret : '';
  if (!clientId || !clientSecret) {
    return c.json({ error: 'invalid_client', error_description: '缺少 client_id / client_secret' }, 401);
  }

  const db = c.get('db');
  const client = await authenticateClient(db, clientId, clientSecret);
  if (!client) {
    return c.json({ error: 'invalid_client', error_description: 'client 鉴权失败' }, 401);
  }

  try {
    if (grant === 'authorization_code') {
      const code = typeof body.code === 'string' ? body.code : '';
      const redirectUri = typeof body.redirect_uri === 'string' ? body.redirect_uri : '';
      if (!code || !redirectUri) {
        return c.json({ error: 'invalid_request', error_description: '缺少 code / redirect_uri' }, 400);
      }
      if (!client.allowedRedirectUris.includes(redirectUri)) {
        return c.json({ error: 'invalid_grant', error_description: 'redirect_uri 不在白名单' }, 400);
      }
      const issued = await consumeCodeAndIssueTokens(db, { code, clientId, redirectUri });
      const userInfo = await loadUserInfo(db, issued.userId);
      return c.json({
        access_token: issued.accessToken,
        refresh_token: issued.refreshToken,
        token_type: 'Bearer',
        expires_in: issued.accessExpiresAt - Math.floor(Date.now() / 1000),
        scope: issued.scope,
        user: userInfo,
      });
    }

    if (grant === 'refresh_token') {
      const refreshToken = typeof body.refresh_token === 'string' ? body.refresh_token : '';
      if (!refreshToken) {
        return c.json({ error: 'invalid_request', error_description: '缺少 refresh_token' }, 400);
      }
      const issued = await rotateRefreshToken(db, { refreshToken, clientId });
      const userInfo = await loadUserInfo(db, issued.userId);
      return c.json({
        access_token: issued.accessToken,
        refresh_token: issued.refreshToken,
        token_type: 'Bearer',
        expires_in: issued.accessExpiresAt - Math.floor(Date.now() / 1000),
        scope: issued.scope,
        user: userInfo,
      });
    }

    return c.json({ error: 'unsupported_grant_type', error_description: `不支持的 grant_type: ${grant}` }, 400);
  } catch (err) {
    if (err instanceof OauthError) {
      return c.json({ error: err.code, error_description: err.message }, err.status as 400 | 401);
    }
    console.error('[oauth/token] 未知错误', err);
    return c.json({ error: 'server_error', error_description: '内部错误' }, 500);
  }
});

oauth.post('/revoke', async (c) => {
  let body: TokenBody;
  try {
    body = (await c.req.json()) as TokenBody;
  } catch {
    return c.json({ error: 'invalid_request', error_description: '请求体不是合法 JSON' }, 400);
  }
  const clientId = typeof body.client_id === 'string' ? body.client_id : '';
  const clientSecret = typeof body.client_secret === 'string' ? body.client_secret : '';
  const token =
    typeof (body as { token?: unknown }).token === 'string' ? ((body as { token?: string }).token ?? '') : '';
  if (!clientId || !clientSecret) {
    return c.json({ error: 'invalid_client' }, 401);
  }
  if (!token) {
    return c.json({ error: 'invalid_request', error_description: '缺少 token' }, 400);
  }
  const db = c.get('db');
  const client = await authenticateClient(db, clientId, clientSecret);
  if (!client) {
    return c.json({ error: 'invalid_client' }, 401);
  }
  // RFC 6749 §2.1：未知 token 返回 200 不报错
  await revokeTokenPair(db, token);
  return c.json({ ok: true });
});

async function loadUserInfo(
  db: Database,
  userId: string,
): Promise<{ id: string; email: string | null; username: string | null }> {
  const row = (
    await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, userId)).limit(1)
  )[0];
  return {
    id: userId,
    email: row?.email ?? null,
    username: row?.name ?? null,
  };
}

export default oauth;
