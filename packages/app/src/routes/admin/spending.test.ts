import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getGlobalConfigMock, setGlobalConfigMock, unsuspendMock } = vi.hoisted(() => ({
  getGlobalConfigMock: vi.fn(),
  setGlobalConfigMock: vi.fn(),
  unsuspendMock: vi.fn(),
}));

vi.mock('../../services/kv-service', () => ({
  KVService: class {
    getGlobalConfig = getGlobalConfigMock;
    setGlobalConfig = setGlobalConfigMock;
  },
}));

vi.mock('../../services/wallet-service', () => ({
  WalletService: class {
    unsuspend = unsuspendMock;
  },
}));

const spendingRoutes = (await import('./spending')).default;
const { usageLogs, rechargeLogs } = (await import('../../db/schema')) as {
  usageLogs: { name?: string };
  rechargeLogs: { name?: string };
};

const USAGE_LOGS = [{ id: 'log-1', userId: 'user-1', modelId: 'gpt-6.2-sol' }];
const RECHARGE_LOGS = [{ id: 'recharge-1', userId: 'user-1', amount: 10 }];

/** 覆盖 spending.ts 用到的 drizzle 链：count 走 .get()（单行对象），列表走 .orderBy().limit().offset() */
function makeDb() {
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          get: async () => ({ count: 2 }),
          orderBy: () => ({
            limit: () => ({
              offset: async () => (table === usageLogs ? USAGE_LOGS : RECHARGE_LOGS),
            }),
          }),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: async () => {},
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => {},
      }),
    }),
  };
}

function makeEnv(
  kvGet: (key: string) => Promise<unknown> = async (key: string) =>
    key.startsWith('stats:daily:') ? 1.5 : key.startsWith('stats:monthly:') ? 12.5 : null,
) {
  return {
    KV: { get: vi.fn(kvGet) },
    ADMIN_EMAIL: 'admin@example.com',
  };
}

function buildApp() {
  const app = new Hono<{ Bindings: Record<string, unknown> }>();
  app.use('*', async (c, next) => {
    c.set('db', makeDb() as never);
    await next();
  });
  app.route('/', spendingRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  getGlobalConfigMock.mockResolvedValue(null);
});

/**
 * workers-types 下 Response.json() 返回 unknown；测试断言统一收敛为递归宽松形状。
 */
type DeepJson = { [key: string]: DeepJson };
const json = async (res: Response): Promise<DeepJson> => (await res.json()) as DeepJson;

describe('POST /set-spending-limit', () => {
  it('合法请求写入限额并返回成功', async () => {
    const res = await buildApp().request(
      '/set-spending-limit',
      {
        method: 'POST',
        body: JSON.stringify({ userId: 'user-1', monthlyLimit: 100 }),
      },
      makeEnv(),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, userId: 'user-1', monthlyLimit: 100, alertThreshold: 0.8 });
  });

  it('缺少 userId 时返回 400 校验错误', async () => {
    const res = await buildApp().request(
      '/set-spending-limit',
      {
        method: 'POST',
        body: JSON.stringify({ monthlyLimit: 100 }),
      },
      makeEnv(),
    );
    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe('validation_error');
  });

  it('monthlyLimit 为负数时返回 400', async () => {
    const res = await buildApp().request(
      '/set-spending-limit',
      {
        method: 'POST',
        body: JSON.stringify({ userId: 'user-1', monthlyLimit: -5 }),
      },
      makeEnv(),
    );
    expect(res.status).toBe(400);
  });
});

describe('POST /unsuspend-user', () => {
  it('缺少 userId 时返回 400', async () => {
    const res = await buildApp().request(
      '/unsuspend-user',
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
      makeEnv(),
    );
    expect(res.status).toBe(400);
    expect(unsuspendMock).not.toHaveBeenCalled();
  });

  it('成功时调用钱包解除暂停', async () => {
    const res = await buildApp().request(
      '/unsuspend-user',
      {
        method: 'POST',
        body: JSON.stringify({ userId: 'user-1' }),
      },
      makeEnv(),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, userId: 'user-1' });
    expect(unsuspendMock).toHaveBeenCalledWith('user-1');
  });
});

describe('GET /global-config', () => {
  it('KV 有配置时原样返回', async () => {
    getGlobalConfigMock.mockResolvedValue({ dailySpendingCap: 50, monthlySpendingCap: 500, isServicePaused: false });
    const res = await buildApp().request('/global-config', {}, makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, config: { dailySpendingCap: 50 } });
  });

  it('KV 无配置时返回带 env adminEmail 的默认值', async () => {
    const res = await buildApp().request('/global-config', {}, makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      config: {
        dailySpendingCap: 0,
        monthlySpendingCap: 0,
        adminEmail: 'admin@example.com',
        isServicePaused: false,
        freeQuota: { enabled: false, amount: 0, modelIds: [] },
      },
    });
  });
});

describe('POST /global-config', () => {
  it('合法配置写入 KV，adminEmail 缺省时回填 env 值', async () => {
    const res = await buildApp().request(
      '/global-config',
      {
        method: 'POST',
        body: JSON.stringify({
          dailySpendingCap: 10,
          monthlySpendingCap: 100,
          isServicePaused: false,
          freeQuota: { enabled: true, amount: 1, modelIds: ['mimo-v2.6'] },
        }),
      },
      makeEnv(),
    );
    expect(res.status).toBe(200);
    expect(setGlobalConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({ dailySpendingCap: 10, adminEmail: 'admin@example.com' }),
    );
  });

  it('dailySpendingCap 为负数时返回 400', async () => {
    const res = await buildApp().request(
      '/global-config',
      {
        method: 'POST',
        body: JSON.stringify({ dailySpendingCap: -1, monthlySpendingCap: 100, isServicePaused: false }),
      },
      makeEnv(),
    );
    expect(res.status).toBe(400);
    expect(setGlobalConfigMock).not.toHaveBeenCalled();
  });
});

describe('GET /usage', () => {
  it('非法分页参数返回 400', async () => {
    const res = await buildApp().request('/usage?page=0', {}, makeEnv());
    expect(res.status).toBe(400);
  });

  it('合法查询返回日志与分页信息', async () => {
    const res = await buildApp().request('/usage?userId=user-1&page=2&pageSize=50', {}, makeEnv());
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.logs).toEqual(USAGE_LOGS);
    expect(body.pagination).toEqual({ page: 2, pageSize: 50, total: 2, totalPages: 1 });
  });
});

describe('GET /spending-stats', () => {
  it('聚合 KV 日/月消费与全局配置', async () => {
    const res = await buildApp().request('/spending-stats', {}, makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      stats: {
        dailySpending: 1.5,
        monthlySpending: 12.5,
        dailySpendingCap: 0,
        monthlySpendingCap: 0,
        isServicePaused: false,
      },
    });
  });

  it('KV 统计缺失时回退为 0', async () => {
    const emptyEnv = makeEnv(async () => null);
    const res = await buildApp().request('/spending-stats', {}, emptyEnv);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ stats: { dailySpending: 0, monthlySpending: 0 } });
  });
});

describe('GET /recharge-logs', () => {
  it('默认分页返回充值记录', async () => {
    const res = await buildApp().request('/recharge-logs?userId=user-1', {}, makeEnv());
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.logs).toEqual(RECHARGE_LOGS);
    expect(body.pagination).toEqual({ page: 1, pageSize: 20, total: 2, totalPages: 1 });
  });

  it('越界分页参数被收敛（page ≥ 1、pageSize ≤ 100）', async () => {
    const res = await buildApp().request('/recharge-logs?page=-5&pageSize=500', {}, makeEnv());
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.pagination).toEqual({ page: 1, pageSize: 100, total: 2, totalPages: 1 });
  });
});
