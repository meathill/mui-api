import { generateId, hashApiKey } from '@muirouter/shared-db/crypto';
import { and, eq, lt } from 'drizzle-orm';
import type { Database } from '../db';
import { oauthClients, oauthCodes, oauthTokens } from '../db/schema';

/**
 * OAuth 2.0 token / code 服务。
 *
 * 命名约定：
 *   - access_token  以 `mr_at_` 开头，1h 过期（环境可覆盖）
 *   - refresh_token 以 `mr_rt_` 开头，30d 过期
 *   - authorization_code 无前缀，5min 过期
 *
 * 安全：
 *   - 三种 token 一律存 SHA-256 哈希，原文仅在颁发时返回一次。
 *   - access + refresh 共享 `pairId`，refresh 时按 pairId 把整对替换；revoke 同理。
 *   - code 单次消费，`used=1` 后再来 invalid_grant；保留行而非删除，便于排查重放攻击。
 */

export const ACCESS_TOKEN_PREFIX = 'mr_at_';
export const REFRESH_TOKEN_PREFIX = 'mr_rt_';

const DEFAULT_ACCESS_TTL_SEC = 60 * 60; // 1h
const DEFAULT_REFRESH_TTL_SEC = 30 * 24 * 60 * 60; // 30d
const CODE_TTL_SEC = 5 * 60; // 5min

export type IssueResult = {
  accessToken: string;
  refreshToken: string;
  /** 绝对秒时间戳（access）。 */
  accessExpiresAt: number;
  /** 绝对秒时间戳（refresh）。 */
  refreshExpiresAt: number;
  scope: string;
  pairId: string;
};

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function randomToken(prefix: string): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `${prefix}${base64}`;
}

export async function generateAuthorizationCode(): Promise<string> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/** 写一条 oauth_codes，返回原文 code（只在颁发时返回一次）。 */
export async function writeAuthorizationCode(
  db: Database,
  params: { clientId: string; userId: string; redirectUri: string; scope: string },
): Promise<{ code: string; expiresAt: number }> {
  const code = await generateAuthorizationCode();
  const codeHash = await hashApiKey(code);
  const expiresAt = nowSec() + CODE_TTL_SEC;
  await db.insert(oauthCodes).values({
    codeHash,
    clientId: params.clientId,
    userId: params.userId,
    redirectUri: params.redirectUri,
    scope: params.scope,
    expiresAt: new Date(expiresAt * 1000),
    used: false,
  });
  return { code, expiresAt };
}

/**
 * 用 code 换 token：校验 code 合法性 + 一次性消费 + 颁发 access/refresh + 写表。
 * 返回原文 token（只此一次）。校验失败抛带 OAuth 错误码的 Error。
 */
export async function consumeCodeAndIssueTokens(
  db: Database,
  params: { code: string; clientId: string; redirectUri: string; accessTtlSec?: number; refreshTtlSec?: number },
): Promise<IssueResult & { userId: string }> {
  const codeHash = await hashApiKey(params.code);
  const row = await db.select().from(oauthCodes).where(eq(oauthCodes.codeHash, codeHash)).limit(1);
  const codeRow = row[0];
  if (!codeRow) throw oauthError('invalid_grant', 'authorization_code 不存在');
  if (codeRow.used) throw oauthError('invalid_grant', 'authorization_code 已被消费');
  if (codeRow.clientId !== params.clientId) throw oauthError('invalid_grant', 'client_id 不匹配');
  if (codeRow.redirectUri !== params.redirectUri) throw oauthError('invalid_grant', 'redirect_uri 不匹配');
  const expiresAtSec = Math.floor(codeRow.expiresAt.getTime() / 1000);
  if (expiresAtSec <= nowSec()) throw oauthError('invalid_grant', 'authorization_code 已过期');

  // 标记消费
  await db.update(oauthCodes).set({ used: true }).where(eq(oauthCodes.codeHash, codeHash));

  return {
    ...(await issueTokenPair(db, {
      clientId: params.clientId,
      userId: codeRow.userId,
      scope: codeRow.scope,
      accessTtlSec: params.accessTtlSec,
      refreshTtlSec: params.refreshTtlSec,
    })),
    userId: codeRow.userId,
  };
}

/** 用 refresh_token 换新 token：旧对整对替换。 */
export async function rotateRefreshToken(
  db: Database,
  params: { refreshToken: string; clientId: string; accessTtlSec?: number; refreshTtlSec?: number },
): Promise<IssueResult & { userId: string }> {
  if (!params.refreshToken.startsWith(REFRESH_TOKEN_PREFIX)) {
    throw oauthError('invalid_grant', 'refresh_token 格式不合法');
  }
  const tokenHash = await hashApiKey(params.refreshToken);
  const row = (await db.select().from(oauthTokens).where(eq(oauthTokens.tokenHash, tokenHash)).limit(1))[0];
  if (!row || row.kind !== 'refresh') throw oauthError('invalid_grant', 'refresh_token 不存在或已撤销');
  if (row.clientId !== params.clientId) throw oauthError('invalid_grant', 'client_id 不匹配');
  if (Math.floor(row.expiresAt.getTime() / 1000) <= nowSec()) {
    // 过期：把整对清掉，让客户端重新走 OAuth
    await db.delete(oauthTokens).where(eq(oauthTokens.pairId, row.pairId));
    throw oauthError('invalid_grant', 'refresh_token 已过期');
  }

  // 删旧对，发新对
  await db.delete(oauthTokens).where(eq(oauthTokens.pairId, row.pairId));

  return {
    ...(await issueTokenPair(db, {
      clientId: row.clientId,
      userId: row.userId,
      scope: row.scope,
      accessTtlSec: params.accessTtlSec,
      refreshTtlSec: params.refreshTtlSec,
    })),
    userId: row.userId,
  };
}

async function issueTokenPair(
  db: Database,
  params: { clientId: string; userId: string; scope: string; accessTtlSec?: number; refreshTtlSec?: number },
): Promise<IssueResult> {
  const access = randomToken(ACCESS_TOKEN_PREFIX);
  const refresh = randomToken(REFRESH_TOKEN_PREFIX);
  const accessTtl = params.accessTtlSec ?? DEFAULT_ACCESS_TTL_SEC;
  const refreshTtl = params.refreshTtlSec ?? DEFAULT_REFRESH_TTL_SEC;
  const accessExpires = nowSec() + accessTtl;
  const refreshExpires = nowSec() + refreshTtl;
  const pairId = generateId();
  const [accessHash, refreshHash] = await Promise.all([hashApiKey(access), hashApiKey(refresh)]);

  await db.insert(oauthTokens).values([
    {
      tokenHash: accessHash,
      kind: 'access',
      pairId,
      clientId: params.clientId,
      userId: params.userId,
      scope: params.scope,
      expiresAt: new Date(accessExpires * 1000),
    },
    {
      tokenHash: refreshHash,
      kind: 'refresh',
      pairId,
      clientId: params.clientId,
      userId: params.userId,
      scope: params.scope,
      expiresAt: new Date(refreshExpires * 1000),
    },
  ]);

  return {
    accessToken: access,
    refreshToken: refresh,
    accessExpiresAt: accessExpires,
    refreshExpiresAt: refreshExpires,
    scope: params.scope,
    pairId,
  };
}

/** 撤销一个 token（按 pairId 把整对删除）。token 不存在返回 false 但不抛错——RFC 6749 §2.1。 */
export async function revokeTokenPair(db: Database, token: string): Promise<boolean> {
  if (!token.startsWith(ACCESS_TOKEN_PREFIX) && !token.startsWith(REFRESH_TOKEN_PREFIX)) {
    return false;
  }
  const tokenHash = await hashApiKey(token);
  const row = (
    await db
      .select({ pairId: oauthTokens.pairId })
      .from(oauthTokens)
      .where(eq(oauthTokens.tokenHash, tokenHash))
      .limit(1)
  )[0];
  if (!row) return false;
  await db.delete(oauthTokens).where(eq(oauthTokens.pairId, row.pairId));
  return true;
}

/**
 * 用 access_token 反查 user。给 middleware 用。
 * 返回 null 即无效（不存在 / 已过期）。过期的行顺手删掉以免堆积。
 */
export async function resolveAccessToken(
  db: Database,
  accessToken: string,
): Promise<{ userId: string; clientId: string; scope: string; pairId: string } | null> {
  if (!accessToken.startsWith(ACCESS_TOKEN_PREFIX)) return null;
  const tokenHash = await hashApiKey(accessToken);
  const row = (await db.select().from(oauthTokens).where(eq(oauthTokens.tokenHash, tokenHash)).limit(1))[0];
  if (!row || row.kind !== 'access') return null;
  if (Math.floor(row.expiresAt.getTime() / 1000) <= nowSec()) {
    // 顺手清掉过期 access（refresh 仍可能有效）
    await db.delete(oauthTokens).where(and(eq(oauthTokens.tokenHash, tokenHash)));
    return null;
  }
  return { userId: row.userId, clientId: row.clientId, scope: row.scope, pairId: row.pairId };
}

/** 校验 client_id + client_secret，并返回 redirect_uri 白名单（后续校验 redirect_uri 用）。 */
export async function authenticateClient(
  db: Database,
  clientId: string,
  clientSecret: string,
): Promise<{ allowedRedirectUris: string[]; allowedScopes: string[] } | null> {
  const row = (await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1))[0];
  if (!row || !row.isActive) return null;
  const secretHash = await hashApiKey(clientSecret);
  if (secretHash !== row.clientSecretHash) return null;
  let uris: string[] = [];
  try {
    const parsed = JSON.parse(row.allowedRedirectUris);
    if (Array.isArray(parsed)) uris = parsed.filter((s): s is string => typeof s === 'string');
  } catch {}
  return {
    allowedRedirectUris: uris,
    allowedScopes: row.allowedScopes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

/** 不带 client_secret 校验（authorize 端点没法拿到 secret）。 */
export async function loadActiveClient(
  db: Database,
  clientId: string,
): Promise<{ name: string; allowedRedirectUris: string[]; allowedScopes: string[] } | null> {
  const row = (await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1))[0];
  if (!row || !row.isActive) return null;
  let uris: string[] = [];
  try {
    const parsed = JSON.parse(row.allowedRedirectUris);
    if (Array.isArray(parsed)) uris = parsed.filter((s): s is string => typeof s === 'string');
  } catch {}
  return {
    name: row.name,
    allowedRedirectUris: uris,
    allowedScopes: row.allowedScopes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

/** 后台 cron 调用，清理过期 token / code。无负面影响——已过期的本来就 invalid。 */
export async function pruneExpired(db: Database): Promise<{ tokens: number; codes: number }> {
  const now = new Date();
  const tokenResult = await db.delete(oauthTokens).where(lt(oauthTokens.expiresAt, now));
  const codeResult = await db.delete(oauthCodes).where(lt(oauthCodes.expiresAt, now));
  return {
    tokens:
      typeof tokenResult === 'object' && 'meta' in tokenResult
        ? Number((tokenResult as { meta?: { changes?: number } }).meta?.changes ?? 0)
        : 0,
    codes:
      typeof codeResult === 'object' && 'meta' in codeResult
        ? Number((codeResult as { meta?: { changes?: number } }).meta?.changes ?? 0)
        : 0,
  };
}

export class OauthError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function oauthError(code: string, message: string, status = 400): OauthError {
  return new OauthError(code, message, status);
}
