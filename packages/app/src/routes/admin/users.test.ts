import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUserMock, findUserByEmailMock, setMetadataMock, syncMirrorMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  findUserByEmailMock: vi.fn(),
  setMetadataMock: vi.fn(),
  syncMirrorMock: vi.fn(),
}));

vi.mock('../../services/kv-service', () => ({
  KVService: class {
    getUser = getUserMock;
    findUserByEmail = findUserByEmailMock;
  },
}));

vi.mock('../../services/wallet-service', () => ({
  WalletService: class {
    setMetadata = setMetadataMock;
    syncMirror = syncMirrorMock;
  },
}));

const userRoutes = (await import('./users')).default;

const USER_RECORD = {
  data: { balance: 5.5, concurrency: 0, isSuspended: false },
  metadata: { email: 'user@example.com', maxConcurrency: 5, createdAt: '2026-01-01' },
};

const env = {
  KV: { list: vi.fn() },
  DEFAULT_MAX_CONCURRENCY: '7',
};

function buildApp() {
  const app = new Hono<{ Bindings: Record<string, unknown> }>();
  app.route('/', userRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * workers-types 下 Response.json() 返回 unknown；测试断言统一收敛为递归宽松形状。
 */
type DeepJson = { [key: string]: DeepJson };
const json = async (res: Response): Promise<DeepJson> => (await res.json()) as DeepJson;

describe('GET /', () => {
  it('列出 KV 中有数据的用户，无数据键被跳过', async () => {
    env.KV.list.mockResolvedValue({
      keys: [{ name: 'user:user-1' }, { name: 'user:user-orphan' }],
      list_complete: true,
    });
    getUserMock.mockImplementation(async (userId: string) =>
      userId === 'user-1' ? USER_RECORD : { data: null, metadata: null },
    );

    const res = await buildApp().request('/', {}, env);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.users).toHaveLength(1);
    expect(body.users[0]).toMatchObject({
      userId: 'user-1',
      email: 'user@example.com',
      balance: 5.5,
      maxConcurrency: 5,
    });
    expect(body.cursor).toBeNull();
  });

  it('metadata 缺省 maxConcurrency 时回退到 DEFAULT_MAX_CONCURRENCY', async () => {
    env.KV.list.mockResolvedValue({ keys: [{ name: 'user:user-1' }], list_complete: true });
    getUserMock.mockResolvedValue({
      data: USER_RECORD.data,
      metadata: { email: 'user@example.com', createdAt: '2026-01-01' },
    });

    const res = await buildApp().request('/', {}, env);
    const body = (await res.json()) as { users: Array<{ maxConcurrency: number }> };
    expect(body.users[0].maxConcurrency).toBe(7);
  });

  it('分页未完时透传 cursor', async () => {
    env.KV.list.mockResolvedValue({ keys: [], list_complete: false, cursor: 'next-cursor' });
    const res = await buildApp().request('/', {}, env);
    const body = (await res.json()) as { cursor: string | null };
    expect(body.cursor).toBe('next-cursor');
  });
});

describe('GET /user', () => {
  it('email 与 userId 都缺省时返回 400', async () => {
    const res = await buildApp().request('/user', {}, env);
    expect(res.status).toBe(400);
  });

  it('按 email 查询命中时返回用户信息', async () => {
    findUserByEmailMock.mockResolvedValue('user-1');
    getUserMock.mockResolvedValue(USER_RECORD);

    const res = await buildApp().request('/user?email=user@example.com', {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: Record<string, unknown> };
    expect(body.user).toMatchObject({ userId: 'user-1', email: 'user@example.com', balance: 5.5 });
  });

  it('email 查不到时返回 404', async () => {
    findUserByEmailMock.mockResolvedValue(null);
    const res = await buildApp().request('/user?email=nobody@example.com', {}, env);
    expect(res.status).toBe(404);
  });

  it('userId 查无此人时返回 404', async () => {
    getUserMock.mockResolvedValue({ data: null, metadata: null });
    const res = await buildApp().request('/user?userId=ghost', {}, env);
    expect(res.status).toBe(404);
  });
});

describe('POST /set-concurrency', () => {
  it('maxConcurrency 非法时返回 400', async () => {
    const res = await buildApp().request(
      '/set-concurrency',
      {
        method: 'POST',
        body: JSON.stringify({ userId: 'user-1', maxConcurrency: 0 }),
      },
      env,
    );
    expect(res.status).toBe(400);
    expect(setMetadataMock).not.toHaveBeenCalled();
  });

  it('用户不存在时返回 404', async () => {
    getUserMock.mockResolvedValue({ data: null, metadata: null });
    const res = await buildApp().request(
      '/set-concurrency',
      {
        method: 'POST',
        body: JSON.stringify({ userId: 'ghost', maxConcurrency: 3 }),
      },
      env,
    );
    expect(res.status).toBe(404);
  });

  it('成功时通过 WalletService 写 metadata', async () => {
    getUserMock.mockResolvedValue(USER_RECORD);
    const res = await buildApp().request(
      '/set-concurrency',
      {
        method: 'POST',
        body: JSON.stringify({ userId: 'user-1', maxConcurrency: 10 }),
      },
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, userId: 'user-1', maxConcurrency: 10 });
    expect(setMetadataMock).toHaveBeenCalledWith('user-1', { maxConcurrency: 10 });
  });
});

describe('POST /sync-wallet-mirror', () => {
  it('userId 与 email 都缺省时返回 404', async () => {
    const res = await buildApp().request(
      '/sync-wallet-mirror',
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
      env,
    );
    expect(res.status).toBe(404);
    expect(syncMirrorMock).not.toHaveBeenCalled();
  });

  it('按 email 解析 userId 后同步镜像', async () => {
    findUserByEmailMock.mockResolvedValue('user-1');
    syncMirrorMock.mockResolvedValue({ data: { balance: 9.9, concurrency: 1 } });

    const res = await buildApp().request(
      '/sync-wallet-mirror',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'user@example.com' }),
      },
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, userId: 'user-1', balance: 9.9, concurrency: 1 });
  });

  it('syncMirror 抛错时返回 500', async () => {
    syncMirrorMock.mockRejectedValue(new Error('DO unavailable'));
    const res = await buildApp().request(
      '/sync-wallet-mirror',
      {
        method: 'POST',
        body: JSON.stringify({ userId: 'user-1' }),
      },
      env,
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: { type: 'internal_error' } });
  });
});
