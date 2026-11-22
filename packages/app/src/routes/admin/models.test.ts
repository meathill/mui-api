import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { refreshMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
}));

vi.mock('../../services/service-factory', () => ({
  createProxyServices: vi.fn(() => ({
    modelCatalog: { refresh: refreshMock },
  })),
}));

const modelRoutes = (await import('./models')).default;

const EXISTING_MODEL = {
  id: 'gpt-6.2-sol',
  provider: 'openai',
  upstreamModelId: 'gpt-6.2-sol',
  inputPrice: 2,
  outputPrice: 10,
  markupRate: 1.2,
};

const VALID_CREATE = {
  id: 'new-model',
  provider: 'openai',
  upstreamModelId: 'new-model-upstream',
  inputPrice: 1,
  outputPrice: 2,
};

/** 覆盖 models.ts 用到的 drizzle 链；existing 决定 select 命中的记录 */
function makeDb(existing: unknown, options: { insertError?: Error } = {}) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          get: async () => existing,
        }),
      }),
    }),
    insert: () => ({
      values: async () => {
        if (options.insertError) throw options.insertError;
      },
    }),
    update: () => ({
      set: () => ({
        where: async () => {},
      }),
    }),
    delete: () => ({
      where: async () => {},
    }),
  };
}

function buildApp(db: unknown) {
  const app = new Hono<{ Bindings: Record<string, unknown> }>();
  app.use('*', async (c, next) => {
    c.set('db', db as never);
    await next();
  });
  app.route('/', modelRoutes);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /', () => {
  it('返回全部模型列表', async () => {
    const db = {
      select: () => ({
        from: async () => [EXISTING_MODEL],
      }),
    };
    const res = await buildApp(db).request('/');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, models: [EXISTING_MODEL] });
  });
});

describe('POST /', () => {
  it('合法请求创建模型并刷新目录缓存', async () => {
    const res = await buildApp(makeDb(null)).request('/', {
      method: 'POST',
      body: JSON.stringify(VALID_CREATE),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ success: true, model: VALID_CREATE });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('provider 不合法时返回 400 且不刷新缓存', async () => {
    const res = await buildApp(makeDb(null)).request('/', {
      method: 'POST',
      body: JSON.stringify({ ...VALID_CREATE, provider: 'not-a-provider' }),
    });
    expect(res.status).toBe(400);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('模型 ID 冲突时返回 400 已存在', async () => {
    const res = await buildApp(makeDb(null, { insertError: new Error('UNIQUE constraint failed: models.id') })).request(
      '/',
      {
        method: 'POST',
        body: JSON.stringify(VALID_CREATE),
      },
    );
    expect(res.status).toBe(400);
    const errorBody = (await res.json()) as { error: { message: string } };
    expect(errorBody.error.message).toContain('已存在');
  });
});

describe('PUT /:id', () => {
  it('模型不存在时返回 404', async () => {
    const res = await buildApp(makeDb(null)).request('/ghost', {
      method: 'PUT',
      body: JSON.stringify({ inputPrice: 3 }),
    });
    expect(res.status).toBe(404);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('合法更新返回合并后的模型并刷新缓存', async () => {
    const res = await buildApp(makeDb(EXISTING_MODEL)).request('/gpt-6.2-sol', {
      method: 'PUT',
      body: JSON.stringify({ inputPrice: 3 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; model: Record<string, unknown> };
    expect(body.success).toBe(true);
    expect(body.model).toMatchObject({ id: 'gpt-6.2-sol', inputPrice: 3, outputPrice: 10 });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('更新 body 非法时返回 400', async () => {
    const res = await buildApp(makeDb(EXISTING_MODEL)).request('/gpt-6.2-sol', {
      method: 'PUT',
      body: JSON.stringify({ inputPrice: -1 }),
    });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /:id', () => {
  it('模型不存在时返回 404', async () => {
    const res = await buildApp(makeDb(null)).request('/ghost', { method: 'DELETE' });
    expect(res.status).toBe(404);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('成功删除返回 modelId 并刷新缓存', async () => {
    const res = await buildApp(makeDb(EXISTING_MODEL)).request('/gpt-6.2-sol', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, modelId: 'gpt-6.2-sol' });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
