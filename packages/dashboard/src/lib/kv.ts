/**
 * KV 操作工具函数
 * 与 packages/app/src/services/kv-service.ts 使用相同的 key 格式和数据结构
 */
import { getCloudflareContext } from '@opennextjs/cloudflare';

// ==================== 类型定义 ====================

export interface KVUserData {
  balance: number;
  concurrency: number; // Durable Object 同步回 KV 的并发展示镜像，仅用于展示
  isSuspended?: boolean;
}

export interface KVUserMetadata {
  maxConcurrency?: number;
  rateMultiplier?: number; // 用户费率倍率，默认 1
  stripeCustomerId?: string;
  email: string;
  createdAt: string;
}

export interface GlobalConfig {
  dailySpendingCap: number;
  monthlySpendingCap: number;
  adminEmail: string;
  isServicePaused: boolean;
}

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

export async function setUserData(
  kv: KVNamespace,
  userId: string,
  data: KVUserData,
  metadata: KVUserMetadata,
): Promise<void> {
  await kv.put(`${USER_KEY_PREFIX}${userId}`, JSON.stringify(data), { metadata });
}

export async function createUser(
  kv: KVNamespace,
  userId: string,
  email: string,
  initialBalance: number = 0,
): Promise<void> {
  const data: KVUserData = { balance: initialBalance, concurrency: 0 };
  const metadata: KVUserMetadata = { email, createdAt: new Date().toISOString() };
  await setUserData(kv, userId, data, metadata);
}

export async function addBalance(kv: KVNamespace, userId: string, amount: number): Promise<number> {
  const { data, metadata } = await getUserData(kv, userId);
  if (!data || !metadata) throw new Error('用户不存在');
  data.balance += amount;
  await setUserData(kv, userId, data, metadata);
  return data.balance;
}

export async function unsuspendUser(kv: KVNamespace, userId: string): Promise<void> {
  const { data, metadata } = await getUserData(kv, userId);
  if (data && metadata) {
    data.isSuspended = false;
    await setUserData(kv, userId, data, metadata);
  }
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
