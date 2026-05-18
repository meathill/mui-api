import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../db';
import type { Model } from '../db/schema';
import type { KVService } from './kv-service';
import { ModelCatalogService } from './model-catalog-service';

function makeModel(id: string, overrides: Partial<Model> = {}): Model {
  return {
    id,
    provider: 'openai',
    upstreamModelId: id,
    inputPrice: 1,
    outputPrice: 2,
    markupRate: 1.2,
    cachedInputPrice: null,
    cacheWritePrice: null,
    longContextThresholdTokens: null,
    longContextInputPrice: null,
    longContextCachedInputPrice: null,
    longContextCacheWritePrice: null,
    longContextOutputPrice: null,
    ...overrides,
  };
}

interface MockKvState {
  catalog: Model[] | null;
  getCalls: number;
  setCalls: number;
}

function makeMockKv(initial: Model[] | null): { kv: KVService; state: MockKvState } {
  const state: MockKvState = { catalog: initial, getCalls: 0, setCalls: 0 };
  const kv = {
    async getModelsCatalog() {
      state.getCalls += 1;
      return state.catalog;
    },
    async setModelsCatalog(models: Model[]) {
      state.setCalls += 1;
      state.catalog = models;
    },
  } as unknown as KVService;
  return { kv, state };
}

function makeMockDb(rows: Model[]): { db: Database; selectCalls: number } {
  let selectCalls = 0;
  const db = {
    select: () => ({
      from: () => {
        selectCalls += 1;
        return Promise.resolve(rows) as unknown as Promise<Model[]>;
      },
    }),
  } as unknown as Database;
  return get(db, () => selectCalls);

  function get(d: Database, calls: () => number) {
    return {
      get db() {
        return d;
      },
      get selectCalls() {
        return calls();
      },
    };
  }
}

describe('ModelCatalogService', () => {
  it('KV 命中：直接返回缓存，不查 DB', async () => {
    const cached = [makeModel('gpt-x')];
    const { kv, state } = makeMockKv(cached);
    const { db, selectCalls } = makeMockDb([makeModel('gpt-from-db')]);
    const service = new ModelCatalogService(kv, db);

    const all = await service.getAll();
    expect(all).toEqual(cached);
    expect(state.getCalls).toBe(1);
    expect(state.setCalls).toBe(0);
    expect(selectCalls).toBe(0);
  });

  it('KV miss：从 DB 拉取并回写 KV', async () => {
    const { kv, state } = makeMockKv(null);
    const dbRows = [makeModel('gpt-x'), makeModel('gpt-y')];
    const { db } = makeMockDb(dbRows);
    const service = new ModelCatalogService(kv, db);

    const all = await service.getAll();
    expect(all.map((m) => m.id)).toContain('gpt-x');
    expect(all.map((m) => m.id)).toContain('gpt-y');
    expect(state.setCalls).toBe(1);
    expect(state.catalog).not.toBeNull();
  });

  it('BUILT_IN_MODELS 在 DB 未配置时补进 catalog', async () => {
    const { kv } = makeMockKv(null);
    const { db } = makeMockDb([]); // DB 完全空
    const service = new ModelCatalogService(kv, db);

    const all = await service.getAll();
    // 应当至少包含内置的 mimo TTS 系列
    const ids = all.map((m) => m.id);
    expect(ids).toContain('mimo-v2.5-tts');
    expect(ids).toContain('gpt-image-2');
  });

  it('DB 中存在同 id 时覆盖 BUILT_IN_MODELS', async () => {
    const { kv } = makeMockKv(null);
    const dbRows = [makeModel('gpt-image-2', { inputPrice: 999 })];
    const { db } = makeMockDb(dbRows);
    const service = new ModelCatalogService(kv, db);

    const m = await service.getById('gpt-image-2');
    expect(m?.inputPrice).toBe(999);
  });

  it('refresh()：无视 KV 缓存，强制从 DB 重读并覆盖', async () => {
    const stale = [makeModel('old')];
    const { kv, state } = makeMockKv(stale);
    const fresh = [makeModel('new')];
    const { db } = makeMockDb(fresh);
    const service = new ModelCatalogService(kv, db);

    const all = await service.refresh();
    expect(all.map((m) => m.id)).toContain('new');
    expect(state.catalog?.map((m) => m.id)).toContain('new');
    expect(state.setCalls).toBe(1);
  });

  it('getById：未找到返回 null', async () => {
    const { kv } = makeMockKv([makeModel('a')]);
    const { db } = makeMockDb([]);
    const service = new ModelCatalogService(kv, db);

    expect(await service.getById('nonexistent')).toBeNull();
    expect(await service.getById('a')).not.toBeNull();
  });

  it('并发 KV miss：只发起一次 DB query', async () => {
    const { kv } = makeMockKv(null);
    const dbSpy = vi.fn(async () => [makeModel('x')] as Model[]);
    const db = {
      select: () => ({ from: () => dbSpy() }),
    } as unknown as Database;
    const service = new ModelCatalogService(kv, db);

    await Promise.all([service.getAll(), service.getAll(), service.getAll()]);
    expect(dbSpy).toHaveBeenCalledTimes(1);
  });
});
