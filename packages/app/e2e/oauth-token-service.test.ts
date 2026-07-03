import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../src/db';
import { oauthClients, oauthCodes, oauthTokens } from '../src/db/schema';
import { hashApiKey } from '@muirouter/shared-db/crypto';
import {
  authenticateClient,
  consumeCodeAndIssueTokens,
  loadActiveClient,
  OauthError,
  pruneExpired,
  resolveAccessToken,
  revokeTokenPair,
  rotateRefreshToken,
  writeAuthorizationCode,
} from '../src/services/oauth-token-service';

/**
 * oauth-token-service E2E：跑在真实 D1 上，因为 code→token、轮换、撤销都是多步
 * DB 流程，mock DB 既脆弱又测不出真实语义。
 */

const db = createDb(env.DB);
const CLIENT_ID = 'test-client-oauth';
const CLIENT_SECRET = 'test-secret-123';
const REDIRECT = 'https://example.com/cb';
const USER_ID = 'test-user-1';

beforeAll(async () => {
  await db.insert(oauthClients).values({
    clientId: CLIENT_ID,
    clientSecretHash: await hashApiKey(CLIENT_SECRET),
    name: 'Test Client',
    allowedRedirectUris: JSON.stringify([REDIRECT]),
    allowedScopes: 'balance,llm',
    isActive: true,
  });
  await db.insert(oauthClients).values({
    clientId: 'test-client-inactive',
    clientSecretHash: await hashApiKey(CLIENT_SECRET),
    name: 'Inactive Client',
    allowedRedirectUris: JSON.stringify([REDIRECT]),
    allowedScopes: 'balance',
    isActive: false,
  });
});

async function issueViaCode(scope = 'balance') {
  const { code } = await writeAuthorizationCode(db, {
    clientId: CLIENT_ID,
    userId: USER_ID,
    redirectUri: REDIRECT,
    scope,
  });
  return consumeCodeAndIssueTokens(db, { code, clientId: CLIENT_ID, redirectUri: REDIRECT });
}

describe('authorization_code 换 token', () => {
  it('完整流程：颁发带前缀的 access/refresh + 回填 userId', async () => {
    const result = await issueViaCode('balance,llm');
    expect(result.accessToken.startsWith('mr_at_')).toBe(true);
    expect(result.refreshToken.startsWith('mr_rt_')).toBe(true);
    expect(result.userId).toBe(USER_ID);
    expect(result.scope).toBe('balance,llm');
    expect(result.pairId).toBeTruthy();
    expect(result.accessExpiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(result.refreshExpiresAt).toBeGreaterThan(result.accessExpiresAt);
  });

  it('code 单次消费：第二次换 token 抛 invalid_grant', async () => {
    const { code } = await writeAuthorizationCode(db, {
      clientId: CLIENT_ID,
      userId: USER_ID,
      redirectUri: REDIRECT,
      scope: 'balance',
    });
    await consumeCodeAndIssueTokens(db, { code, clientId: CLIENT_ID, redirectUri: REDIRECT });
    await expect(
      consumeCodeAndIssueTokens(db, { code, clientId: CLIENT_ID, redirectUri: REDIRECT }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
  });

  it('client_id 不匹配抛 invalid_grant', async () => {
    const { code } = await writeAuthorizationCode(db, {
      clientId: CLIENT_ID,
      userId: USER_ID,
      redirectUri: REDIRECT,
      scope: 'balance',
    });
    await expect(
      consumeCodeAndIssueTokens(db, { code, clientId: 'other-client', redirectUri: REDIRECT }),
    ).rejects.toBeInstanceOf(OauthError);
  });

  it('redirect_uri 不匹配抛 invalid_grant', async () => {
    const { code } = await writeAuthorizationCode(db, {
      clientId: CLIENT_ID,
      userId: USER_ID,
      redirectUri: REDIRECT,
      scope: 'balance',
    });
    await expect(
      consumeCodeAndIssueTokens(db, { code, clientId: CLIENT_ID, redirectUri: 'https://evil.com' }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
  });

  it('过期 code 抛 invalid_grant', async () => {
    const raw = 'expired-code-raw';
    await db.insert(oauthCodes).values({
      codeHash: await hashApiKey(raw),
      clientId: CLIENT_ID,
      userId: USER_ID,
      redirectUri: REDIRECT,
      scope: 'balance',
      expiresAt: new Date(Date.now() - 1000),
      used: false,
    });
    await expect(
      consumeCodeAndIssueTokens(db, { code: raw, clientId: CLIENT_ID, redirectUri: REDIRECT }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
  });
});

describe('refresh_token 轮换', () => {
  it('成功轮换出新对，且旧 refresh 立即失效', async () => {
    const issued = await issueViaCode();
    const rotated = await rotateRefreshToken(db, { refreshToken: issued.refreshToken, clientId: CLIENT_ID });
    expect(rotated.accessToken).not.toBe(issued.accessToken);
    expect(rotated.refreshToken).not.toBe(issued.refreshToken);
    expect(rotated.userId).toBe(USER_ID);
    // 旧 refresh 已随整对删除
    await expect(
      rotateRefreshToken(db, { refreshToken: issued.refreshToken, clientId: CLIENT_ID }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
  });

  it('refresh_token 格式不合法直接抛错', async () => {
    await expect(rotateRefreshToken(db, { refreshToken: 'not-a-refresh', clientId: CLIENT_ID })).rejects.toMatchObject({
      code: 'invalid_grant',
    });
  });

  it('client_id 不匹配抛 invalid_grant', async () => {
    const issued = await issueViaCode();
    await expect(
      rotateRefreshToken(db, { refreshToken: issued.refreshToken, clientId: 'other-client' }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
  });
});

describe('撤销与解析', () => {
  it('revokeTokenPair 按 pairId 整对删除，access 随即解析失败', async () => {
    const issued = await issueViaCode();
    expect(await resolveAccessToken(db, issued.accessToken)).not.toBeNull();
    expect(await revokeTokenPair(db, issued.accessToken)).toBe(true);
    expect(await resolveAccessToken(db, issued.accessToken)).toBeNull();
    // refresh 也随整对失效
    await expect(
      rotateRefreshToken(db, { refreshToken: issued.refreshToken, clientId: CLIENT_ID }),
    ).rejects.toMatchObject({ code: 'invalid_grant' });
  });

  it('revoke 未知 token 返回 false（不抛错，RFC 6749）', async () => {
    expect(await revokeTokenPair(db, 'mr_at_does-not-exist')).toBe(false);
  });

  it('revoke 错误前缀返回 false', async () => {
    expect(await revokeTokenPair(db, 'random-token')).toBe(false);
  });

  it('resolveAccessToken：有效返回 claims，错前缀/过期返回 null', async () => {
    const issued = await issueViaCode('balance,llm');
    const claims = await resolveAccessToken(db, issued.accessToken);
    expect(claims).toMatchObject({ userId: USER_ID, clientId: CLIENT_ID, scope: 'balance,llm' });

    expect(await resolveAccessToken(db, 'mr_rt_wrong-prefix')).toBeNull();

    const expiredRaw = 'mr_at_expired-access';
    await db.insert(oauthTokens).values({
      tokenHash: await hashApiKey(expiredRaw),
      kind: 'access',
      pairId: 'pair-expired',
      clientId: CLIENT_ID,
      userId: USER_ID,
      scope: 'balance',
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await resolveAccessToken(db, expiredRaw)).toBeNull();
  });
});

describe('client 认证', () => {
  it('authenticateClient：正确 secret 返回白名单', async () => {
    const result = await authenticateClient(db, CLIENT_ID, CLIENT_SECRET);
    expect(result).toEqual({ allowedRedirectUris: [REDIRECT], allowedScopes: ['balance', 'llm'] });
  });

  it('authenticateClient：错 secret / inactive / 不存在均返回 null', async () => {
    expect(await authenticateClient(db, CLIENT_ID, 'wrong-secret')).toBeNull();
    expect(await authenticateClient(db, 'test-client-inactive', CLIENT_SECRET)).toBeNull();
    expect(await authenticateClient(db, 'no-such-client', CLIENT_SECRET)).toBeNull();
  });

  it('loadActiveClient：active 返回 name，inactive/未知返回 null', async () => {
    const result = await loadActiveClient(db, CLIENT_ID);
    expect(result).toMatchObject({ name: 'Test Client', allowedRedirectUris: [REDIRECT] });
    expect(await loadActiveClient(db, 'test-client-inactive')).toBeNull();
    expect(await loadActiveClient(db, 'no-such-client')).toBeNull();
  });
});

describe('pruneExpired', () => {
  it('清理过期 token 与 code', async () => {
    await db.insert(oauthTokens).values({
      tokenHash: await hashApiKey('mr_at_prune-me'),
      kind: 'access',
      pairId: 'pair-prune',
      clientId: CLIENT_ID,
      userId: USER_ID,
      scope: 'balance',
      expiresAt: new Date(Date.now() - 60_000),
    });
    await db.insert(oauthCodes).values({
      codeHash: await hashApiKey('prune-code'),
      clientId: CLIENT_ID,
      userId: USER_ID,
      redirectUri: REDIRECT,
      scope: 'balance',
      expiresAt: new Date(Date.now() - 60_000),
      used: false,
    });
    const result = await pruneExpired(db);
    expect(result.tokens).toBeGreaterThanOrEqual(1);
    expect(result.codes).toBeGreaterThanOrEqual(1);
  });
});
