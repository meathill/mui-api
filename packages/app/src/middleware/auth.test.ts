import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashApiKey } from '../lib/crypto';
import { authMiddleware } from './auth';

interface StoredValue {
  value: string;
  metadata?: unknown;
}

function createMockKV() {
  const store = new Map<string, StoredValue>();

  return {
    async get<T>(key: string, type?: string): Promise<T | null> {
      const item = store.get(key);
      if (!item) {
        return null;
      }
      return (type === 'json' ? JSON.parse(item.value) : item.value) as T;
    },
    async getWithMetadata<TValue, TMetadata>(key: string, type?: string) {
      const item = store.get(key);
      if (!item) {
        return { value: null, metadata: null };
      }
      return {
        value: (type === 'json' ? JSON.parse(item.value) : item.value) as TValue,
        metadata: (item.metadata ?? null) as TMetadata | null,
      };
    },
    async put(key: string, value: string, options?: { metadata?: unknown }) {
      store.set(key, { value, metadata: options?.metadata });
    },
    store,
  };
}

function createMockLimiterNamespace() {
  const stateByUser = new Map<
    string,
    {
      activeLeases: Map<string, string>;
      requestLeaseMap: Map<string, string>;
      releases: string[];
      refreshes: string[];
    }
  >();

  function getUserState(userId: string) {
    const existing = stateByUser.get(userId);
    if (existing) {
      return existing;
    }

    const created = {
      activeLeases: new Map<string, string>(),
      requestLeaseMap: new Map<string, string>(),
      releases: [],
      refreshes: [],
    };
    stateByUser.set(userId, created);
    return created;
  }

  return {
    stateByUser,
    namespace: {
      idFromName(name: string) {
        return { name } as DurableObjectId;
      },
      get(id: DurableObjectId) {
        const userId = (id as unknown as { name: string }).name;
        const userState = getUserState(userId);

        return {
          async fetch(input: RequestInfo | URL, init?: RequestInit) {
            const url = new URL(typeof input === 'string' ? input : input.toString());
            const body = Object.fromEntries(url.searchParams.entries());

            if (url.pathname === '/acquire') {
              const existingLeaseId = userState.requestLeaseMap.get(body.requestId);
              if (existingLeaseId) {
                return Response.json({
                  ok: true,
                  leaseId: existingLeaseId,
                  activeCount: userState.activeLeases.size,
                  maxConcurrency: 3,
                });
              }

              const leaseId = `lease-${body.requestId}`;
              userState.activeLeases.set(leaseId, body.requestId);
              userState.requestLeaseMap.set(body.requestId, leaseId);
              return Response.json({
                ok: true,
                leaseId,
                activeCount: userState.activeLeases.size,
                maxConcurrency: 3,
              });
            }

            if (url.pathname === '/refresh') {
              userState.refreshes.push(body.leaseId);
              return Response.json({
                ok: userState.activeLeases.has(body.leaseId),
                activeCount: userState.activeLeases.size,
              });
            }

            if (url.pathname === '/release') {
              userState.releases.push(body.leaseId);
              const requestId = userState.activeLeases.get(body.leaseId);
              userState.activeLeases.delete(body.leaseId);
              if (requestId) {
                userState.requestLeaseMap.delete(requestId);
              }
              return Response.json({
                ok: true,
                activeCount: userState.activeLeases.size,
              });
            }

            return Response.json({ error: 'not_found' }, { status: 404 });
          },
        } as DurableObjectStub;
      },
    } as DurableObjectNamespace,
  };
}

async function seedAuthState(kv: ReturnType<typeof createMockKV>, userId: string, rawKey: string): Promise<void> {
  const keyHash = await hashApiKey(rawKey);

  await kv.put(`apikey:${keyHash}`, userId, {
    metadata: {
      keyPrefix: rawKey.slice(0, 12) + '...',
      isActive: true,
      userId,
    },
  });

  await kv.put(
    `user:${userId}`,
    JSON.stringify({
      balance: 10,
      concurrency: 0,
      isSuspended: false,
    }),
    {
      metadata: {
        email: `${userId}@test.com`,
        createdAt: '2026-04-19T00:00:00.000Z',
      },
    },
  );
}

function createExecutionContext() {
  const promises: Promise<unknown>[] = [];

  return {
    promises,
    executionContext: {
      waitUntil(promise: Promise<unknown>) {
        promises.push(promise);
      },
      passThroughOnException() {},
    } as ExecutionContext,
  };
}

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('普通 JSON 响应在 body 读取完后释放 lease', async () => {
    const kv = createMockKV();
    const limiter = createMockLimiterNamespace();
    await seedAuthState(kv, 'user-1', 'sk-gw-test-json');

    const app = new Hono();
    app.use('*', authMiddleware);
    app.get('/ok', (c) => c.json({ ok: true }));

    const { executionContext } = createExecutionContext();
    const response = await app.fetch(
      new Request('http://localhost/ok', {
        headers: { Authorization: 'Bearer sk-gw-test-json' },
      }),
      {
        KV: kv,
        CONCURRENCY_LIMITER: limiter.namespace,
        DEFAULT_MAX_CONCURRENCY: '3',
      } as never,
      executionContext,
    );

    const userState = limiter.stateByUser.get('user-1')!;
    expect(userState.activeLeases.size).toBe(1);

    await response.json();
    await Promise.resolve();

    expect(userState.activeLeases.size).toBe(0);
    expect(userState.releases).toHaveLength(1);
  });

  it('handler 抛错时立即释放 lease', async () => {
    const kv = createMockKV();
    const limiter = createMockLimiterNamespace();
    await seedAuthState(kv, 'user-1', 'sk-gw-test-throw');

    const app = new Hono();
    app.use('*', authMiddleware);
    app.get('/boom', () => {
      throw new Error('boom');
    });

    const { executionContext } = createExecutionContext();
    const response = await app.fetch(
      new Request('http://localhost/boom', {
        headers: { Authorization: 'Bearer sk-gw-test-throw' },
      }),
      {
        KV: kv,
        CONCURRENCY_LIMITER: limiter.namespace,
        DEFAULT_MAX_CONCURRENCY: '3',
      } as never,
      executionContext,
    );

    expect(response.status).toBe(500);
    const userState = limiter.stateByUser.get('user-1')!;
    expect(userState.activeLeases.size).toBe(0);
    expect(userState.releases).toHaveLength(1);
  });

  it('流式响应 EOF 后释放 lease', async () => {
    const kv = createMockKV();
    const limiter = createMockLimiterNamespace();
    await seedAuthState(kv, 'user-1', 'sk-gw-test-stream');

    const app = new Hono();
    app.use('*', authMiddleware);
    app.get('/stream', (c) =>
      c.body(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('hello'));
            controller.close();
          },
        }),
      ),
    );

    const { executionContext } = createExecutionContext();
    const response = await app.fetch(
      new Request('http://localhost/stream', {
        headers: { Authorization: 'Bearer sk-gw-test-stream' },
      }),
      {
        KV: kv,
        CONCURRENCY_LIMITER: limiter.namespace,
        DEFAULT_MAX_CONCURRENCY: '3',
      } as never,
      executionContext,
    );

    await response.text();
    await Promise.resolve();

    const userState = limiter.stateByUser.get('user-1')!;
    expect(userState.activeLeases.size).toBe(0);
    expect(userState.releases).toHaveLength(1);
  });

  it('客户端取消流时释放 lease', async () => {
    const kv = createMockKV();
    const limiter = createMockLimiterNamespace();
    await seedAuthState(kv, 'user-1', 'sk-gw-test-cancel');

    const app = new Hono();
    app.use('*', authMiddleware);
    app.get('/cancel', (c) =>
      c.body(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('chunk-1'));
          },
          cancel() {},
        }),
      ),
    );

    const { executionContext } = createExecutionContext();
    const response = await app.fetch(
      new Request('http://localhost/cancel', {
        headers: { Authorization: 'Bearer sk-gw-test-cancel' },
      }),
      {
        KV: kv,
        CONCURRENCY_LIMITER: limiter.namespace,
        DEFAULT_MAX_CONCURRENCY: '3',
      } as never,
      executionContext,
    );

    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel('done');
    await Promise.resolve();

    const userState = limiter.stateByUser.get('user-1')!;
    expect(userState.activeLeases.size).toBe(0);
    expect(userState.releases).toHaveLength(1);
  });
});
