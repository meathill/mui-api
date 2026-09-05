import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OauthError } from '../services/oauth-token-service';

const { authenticateClientMock, consumeCodeMock, rotateMock, revokeMock } = vi.hoisted(() => ({
  authenticateClientMock: vi.fn(),
  consumeCodeMock: vi.fn(),
  rotateMock: vi.fn(),
  revokeMock: vi.fn(),
}));

vi.mock('../services/oauth-token-service', () => ({
  authenticateClient: authenticateClientMock,
  consumeCodeAndIssueTokens: consumeCodeMock,
  rotateRefreshToken: rotateMock,
  revokeTokenPair: revokeMock,
  OauthError: class OauthErrorMock extends Error {
    readonly code: string;
    readonly status: number;
    constructor(code: string, message: string, status = 400) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));

const oauthRoute = (await import('./oauth')).default;

const CLIENT = { allowedRedirectUris: ['https://app.example.com/cb'] };

const fakeDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        limit: async () => [{ email: 'user@example.com', name: 'User' }],
      }),
    }),
  }),
};

function buildApp() {
  const app = new Hono<{ Bindings: Record<string, unknown> }>();
  app.use('*', async (c, next) => {
    c.set('db', fakeDb as never);
    await next();
  });
  app.route('/', oauthRoute);
  return app;
}

function issuedTokens() {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    userId: 'user-1',
    accessExpiresAt: Math.floor(Date.now() / 1000) + 3600,
    scope: 'read',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authenticateClientMock.mockResolvedValue(CLIENT);
  consumeCodeMock.mockResolvedValue(issuedTokens());
  rotateMock.mockResolvedValue(issuedTokens());
  revokeMock.mockResolvedValue(undefined);
});

describe('POST /token', () => {
  it('请求体不是合法 JSON 时返回 400 invalid_request', async () => {
    const res = await buildApp().request('/token', {
      method: 'POST',
      body: '{not-json',
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_request' });
  });

  it('缺少 client_id / client_secret 时返回 401 invalid_client', async () => {
    const res = await buildApp().request('/token', {
      method: 'POST',
      body: JSON.stringify({ grant_type: 'refresh_token' }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'invalid_client' });
  });

  it('client 鉴权失败时返回 401 invalid_client', async () => {
    authenticateClientMock.mockResolvedValue(null);
    const res = await buildApp().request('/token', {
      method: 'POST',
      body: JSON.stringify({ grant_type: 'refresh_token', client_id: 'cid', client_secret: 'bad' }),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'invalid_client' });
  });

  it('不支持的 grant_type 返回 400 unsupported_grant_type', async () => {
    const res = await buildApp().request('/token', {
      method: 'POST',
      body: JSON.stringify({ grant_type: 'password', client_id: 'cid', client_secret: 'sec' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'unsupported_grant_type' });
  });

  it('authorization_code 成功：返回 token 对与 user 信息，redirect_uri 透传给服务层', async () => {
    const res = await buildApp().request('/token', {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: 'cid',
        client_secret: 'sec',
        code: 'the-code',
        redirect_uri: 'https://app.example.com/cb',
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      token_type: 'Bearer',
      scope: 'read',
      user: { id: 'user-1', email: 'user@example.com', username: 'User' },
    });
    expect(body.expires_in).toBeGreaterThan(3500);
    expect(consumeCodeMock).toHaveBeenCalledWith(expect.anything(), {
      code: 'the-code',
      clientId: 'cid',
      redirectUri: 'https://app.example.com/cb',
    });
  });

  it('authorization_code：redirect_uri 不在白名单返回 400 invalid_grant，不消费 code', async () => {
    const res = await buildApp().request('/token', {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: 'cid',
        client_secret: 'sec',
        code: 'the-code',
        redirect_uri: 'https://evil.example.com/cb',
      }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_grant' });
    expect(consumeCodeMock).not.toHaveBeenCalled();
  });

  it('authorization_code：缺少 code / redirect_uri 返回 400 invalid_request', async () => {
    const res = await buildApp().request('/token', {
      method: 'POST',
      body: JSON.stringify({ grant_type: 'authorization_code', client_id: 'cid', client_secret: 'sec' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_request' });
  });

  it('refresh_token 成功：返回轮换后的 token 对', async () => {
    const res = await buildApp().request('/token', {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: 'cid',
        client_secret: 'sec',
        refresh_token: 'rt-old',
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ access_token: 'access-token', refresh_token: 'refresh-token' });
    expect(rotateMock).toHaveBeenCalledWith(expect.anything(), { refreshToken: 'rt-old', clientId: 'cid' });
  });

  it('refresh_token：缺少 refresh_token 返回 400', async () => {
    const res = await buildApp().request('/token', {
      method: 'POST',
      body: JSON.stringify({ grant_type: 'refresh_token', client_id: 'cid', client_secret: 'sec' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_request' });
  });

  it('服务层抛 OauthError 时透传 code 与 status', async () => {
    rotateMock.mockRejectedValue(new OauthError('invalid_grant', 'refresh token 已失效', 400));
    const res = await buildApp().request('/token', {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: 'cid',
        client_secret: 'sec',
        refresh_token: 'rt',
      }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_grant', error_description: 'refresh token 已失效' });
  });

  it('未知异常返回 500 server_error', async () => {
    rotateMock.mockRejectedValue(new Error('boom'));
    const res = await buildApp().request('/token', {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: 'cid',
        client_secret: 'sec',
        refresh_token: 'rt',
      }),
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'server_error' });
  });
});

describe('POST /revoke', () => {
  it('缺少 client 凭证返回 401，缺少 token 返回 400', async () => {
    const app = buildApp();
    const noClient = await app.request('/revoke', { method: 'POST', body: JSON.stringify({}) });
    expect(noClient.status).toBe(401);

    const noToken = await app.request('/revoke', {
      method: 'POST',
      body: JSON.stringify({ client_id: 'cid', client_secret: 'sec' }),
    });
    expect(noToken.status).toBe(400);
    expect(await noToken.json()).toMatchObject({ error: 'invalid_request' });
  });

  it('撤销成功返回 200；未知 token 按 RFC 6749 也返回 200', async () => {
    const app = buildApp();
    const ok = await app.request('/revoke', {
      method: 'POST',
      body: JSON.stringify({ client_id: 'cid', client_secret: 'sec', token: 'tok-1' }),
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true });

    revokeMock.mockResolvedValue(undefined);
    const unknown = await app.request('/revoke', {
      method: 'POST',
      body: JSON.stringify({ client_id: 'cid', client_secret: 'sec', token: 'unknown-token' }),
    });
    expect(unknown.status).toBe(200);
    expect(revokeMock).toHaveBeenCalledTimes(2);
  });

  it('请求体不是合法 JSON 时返回 400', async () => {
    const res = await buildApp().request('/revoke', {
      method: 'POST',
      body: 'nope',
      headers: { 'content-type': 'application/json' },
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_request' });
  });
});
