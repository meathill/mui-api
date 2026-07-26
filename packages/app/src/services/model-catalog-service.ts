import type { Database } from '../db';
import { type Model, models } from '../db/schema';
import type { KVService } from './kv-service';

/** built-in 模型不参与 models.dev 收录，元数据一律留空。 */
const NO_METADATA = {
  displayName: null,
  contextLength: null,
  maxOutputTokens: null,
  metadataJson: null,
} as const;

const ZERO_TIER_PRICING = {
  cachedInputPrice: null,
  cacheWritePrice: null,
  longContextThresholdTokens: null,
  longContextInputPrice: null,
  longContextCachedInputPrice: null,
  longContextCacheWritePrice: null,
  longContextOutputPrice: null,
} as const;

/**
 * 静态内置模型 —— 不写入 D1、不可由 admin 编辑。
 * 主要承载 TTS 这类长期免费 / 不收费的特殊型号，避免污染 admin 价格管理表。
 * 当上游开始收费时，应迁出本表、改为 admin 配置或 seed。
 */
const BUILT_IN_MODELS: Model[] = [
  {
    id: 'gpt-image-2',
    provider: 'openai',
    upstreamModelId: 'gpt-image-2',
    inputPrice: 8,
    outputPrice: 30,
    markupRate: 1.2,
    ...NO_METADATA,
    ...ZERO_TIER_PRICING,
  },
  {
    id: 'mimo-v2.5-tts',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2.5-tts',
    inputPrice: 0,
    outputPrice: 0,
    markupRate: 1.2,
    ...NO_METADATA,
    ...ZERO_TIER_PRICING,
  },
  {
    id: 'mimo-v2.5-tts-voiceclone',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2.5-tts-voiceclone',
    inputPrice: 0,
    outputPrice: 0,
    markupRate: 1.2,
    ...NO_METADATA,
    ...ZERO_TIER_PRICING,
  },
  {
    id: 'mimo-v2.5-tts-voicedesign',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2.5-tts-voicedesign',
    inputPrice: 0,
    outputPrice: 0,
    markupRate: 1.2,
    ...NO_METADATA,
    ...ZERO_TIER_PRICING,
  },
  {
    id: 'mimo-v2-tts',
    provider: 'xiaomi-mimo',
    upstreamModelId: 'mimo-v2-tts',
    inputPrice: 0,
    outputPrice: 0,
    markupRate: 1.2,
    ...NO_METADATA,
    ...ZERO_TIER_PRICING,
  },
];

/**
 * 模型 catalog 读取层：
 *  - 读路径：KV 优先 → miss 回源 D1 → 回写 KV
 *  - 写路径：admin CRUD / seed 必须调 refresh() 以保证 KV 与 D1 对齐
 *
 * 没有 TTL 兜底：模型表只有 admin 一条受控写路径，TTL 只会引入随机的 D1 query 尖刺。
 */
export class ModelCatalogService {
  private inFlight: Promise<Model[]> | null = null;

  constructor(
    private kvService: KVService,
    private db: Database,
  ) {}

  /**
   * 返回完整 catalog（DB 行与 BUILT_IN_MODELS 合并，DB 优先）。
   */
  async getAll(): Promise<Model[]> {
    const cached = await this.kvService.getModelsCatalog();
    if (cached) return cached;

    // 并发去重：同一 isolate 内多个请求同时遇到 KV miss 时，只发起一次 D1 query。
    this.inFlight ??= this.loadFromDbAndCache();
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  async getById(id: string): Promise<Model | null> {
    const all = await this.getAll();
    return all.find((model) => model.id === id) ?? null;
  }

  /**
   * 强制从 D1 重读并覆盖 KV。admin CRUD / seed 写入后调用。
   */
  async refresh(): Promise<Model[]> {
    return this.loadFromDbAndCache();
  }

  private async loadFromDbAndCache(): Promise<Model[]> {
    const dbRows = await this.db.select().from(models);
    const merged = mergeWithBuiltIns(dbRows);
    await this.kvService.setModelsCatalog(merged);
    return merged;
  }
}

/** DB 行优先；DB 没有的 built-in 才补进来。 */
function mergeWithBuiltIns(dbRows: Model[]): Model[] {
  const dbIds = new Set(dbRows.map((row) => row.id));
  const builtInRest = BUILT_IN_MODELS.filter((row) => !dbIds.has(row.id));
  return [...dbRows, ...builtInRest];
}
