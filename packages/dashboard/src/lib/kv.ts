/**
 * KV 操作工具函数
 * 与 packages/app/src/services/kv-service.ts 使用相同的 key 格式和数据结构
 */
import type {
  FreeQuotaConfig,
  FreeQuotaStatus,
  GlobalConfig,
  KVUserData,
  KVUserMetadata,
} from '@muirouter/shared-db/types';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// ==================== 类型定义 ====================
// 数据形状定义已上移到 shared-db（app / dashboard 共用），此处转发保持既有 import 路径
export type { FreeQuotaConfig, FreeQuotaStatus, GlobalConfig, KVUserData, KVUserMetadata };

export interface ApiKeyMetadata {
  keyPrefix: string;
  isActive: boolean;
  userId: string;
  createdAt?: string;
}

// ==================== KV Key 前缀 ====================

const USER_KEY_PREFIX = 'user:';
const APIKEY_PREFIX = 'apikey:';
const GLOBAL_CONFIG_KEY = 'config:global';
const GLOBAL_SPENDING_PREFIX = 'stats:';
const MODELS_CATALOG_KEY = 'models:catalog';
const DEFAULT_FREE_QUOTA_CONFIG: FreeQuotaConfig = {
  enabled: false,
  amount: 0,
  modelIds: [],
};

// ==================== 基础工具 ====================

export async function getKV(): Promise<KVNamespace> {
  const { env } = await getCloudflareContext({ async: true });
  return env.KV;
}

// ==================== 用户数据 ====================

export async function getUserData(
  kv: KVNamespace,
  userId: string,
): Promise<{ data: KVUserData | null; metadata: KVUserMetadata | null }> {
  const result = await kv.getWithMetadata<KVUserData, KVUserMetadata>(`${USER_KEY_PREFIX}${userId}`, 'json');
  return { data: result.value, metadata: result.metadata };
}

// ==================== API Key ====================

export async function listUserApiKeys(
  kv: KVNamespace,
  userId: string,
): Promise<Array<{ id: string; keyPrefix: string; isActive: boolean; createdAt: string }>> {
  const list = await kv.list({ prefix: APIKEY_PREFIX });
  const keys: Array<{ id: string; keyPrefix: string; isActive: boolean; createdAt: string }> = [];

  for (const key of list.keys) {
    const metadata = key.metadata as ApiKeyMetadata | null;
    if (metadata && metadata.userId === userId) {
      keys.push({
        id: key.name,
        keyPrefix: metadata.keyPrefix || 'sk-gw-...',
        isActive: metadata.isActive ?? true,
        createdAt: metadata.createdAt || '',
      });
    }
  }
  return keys;
}

export async function storeApiKey(kv: KVNamespace, keyHash: string, userId: string, keyPrefix: string): Promise<void> {
  const metadata: ApiKeyMetadata = {
    keyPrefix,
    isActive: true,
    userId,
    createdAt: new Date().toISOString(),
  };
  await kv.put(`${APIKEY_PREFIX}${keyHash}`, userId, { metadata });
}

export async function deleteApiKey(kv: KVNamespace, keyId: string): Promise<void> {
  await kv.delete(keyId);
}

export async function getApiKeyMetadata(kv: KVNamespace, keyId: string): Promise<ApiKeyMetadata | null> {
  const result = await kv.getWithMetadata(keyId, 'text');
  return (result.metadata as ApiKeyMetadata) ?? null;
}

// ==================== 全局配置 ====================

export async function getGlobalConfig(kv: KVNamespace): Promise<GlobalConfig | null> {
  return kv.get<GlobalConfig>(GLOBAL_CONFIG_KEY, 'json');
}

export async function setGlobalConfig(kv: KVNamespace, config: GlobalConfig): Promise<void> {
  await kv.put(GLOBAL_CONFIG_KEY, JSON.stringify(config));
}

/**
 * 失效 KV 模型 catalog 缓存。dashboard 写入 models 表后调用，
 * 后端 ModelCatalogService 下一次 getAll() 会自动回源 D1 重新填充。
 */
export async function invalidateModelsCatalog(kv: KVNamespace): Promise<void> {
  await kv.delete(MODELS_CATALOG_KEY);
}

export function normalizeFreeQuotaConfig(config: Partial<FreeQuotaConfig> | null | undefined): FreeQuotaConfig {
  if (!config) {
    return DEFAULT_FREE_QUOTA_CONFIG;
  }

  return {
    enabled: config.enabled === true,
    amount: Math.max(0, Number(config.amount) || 0),
    modelIds: Array.from(
      new Set((Array.isArray(config.modelIds) ? config.modelIds : []).map((id) => id.trim()).filter(Boolean)),
    ),
  };
}

export function getFreeQuotaStatus(config: GlobalConfig | null, data: KVUserData | null): FreeQuotaStatus {
  const freeQuota = normalizeFreeQuotaConfig(config?.freeQuota);
  const used = Math.max(0, data?.freeQuotaUsed ?? 0);
  const remaining = freeQuota.enabled ? Math.max(0, freeQuota.amount - used) : 0;

  return {
    ...freeQuota,
    used,
    remaining,
  };
}

// ==================== 消费统计 ====================

export async function getSpendingStats(kv: KVNamespace): Promise<{
  dailySpending: number;
  monthlySpending: number;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);

  const [daily, monthly] = await Promise.all([
    kv.get<number>(`${GLOBAL_SPENDING_PREFIX}daily:${today}`, 'json'),
    kv.get<number>(`${GLOBAL_SPENDING_PREFIX}monthly:${month}`, 'json'),
  ]);

  return {
    dailySpending: daily ?? 0,
    monthlySpending: monthly ?? 0,
  };
}

// ==================== 用户列表（管理员用） ====================

export async function listAllUsers(
  kv: KVNamespace,
  cursor?: string,
  defaultMaxConcurrency: number = 3,
): Promise<{
  users: Array<{
    userId: string;
    email: string;
    balance: number;
    concurrency: number;
    isSuspended: boolean;
    maxConcurrency: number;
    createdAt: string;
  }>;
  cursor: string | null;
}> {
  const list = await kv.list<KVUserMetadata>({
    prefix: USER_KEY_PREFIX,
    cursor: cursor || undefined,
    limit: 50,
  });

  // kv.list 返回 metadata 但不返回 value，需要并行批量获取 value
  const results = await Promise.all(
    list.keys.map(async (key) => {
      const metadata = key.metadata;
      if (!metadata) return null;

      const value = await kv.get<KVUserData>(key.name, 'json');
      if (!value) return null;

      return {
        userId: key.name.replace(USER_KEY_PREFIX, ''),
        email: metadata.email,
        balance: value.balance,
        concurrency: value.concurrency,
        isSuspended: value.isSuspended ?? false,
        maxConcurrency: metadata.maxConcurrency ?? defaultMaxConcurrency,
        createdAt: metadata.createdAt,
      };
    }),
  );

  return {
    users: results.filter((u) => u !== null),
    cursor: list.list_complete ? null : list.cursor,
  };
}
