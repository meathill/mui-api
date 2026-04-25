import { env } from 'cloudflare:test';

/**
 * E2E 测试辅助函数
 */

/**
 * 在 KV 中注册 API Key，返回可用于 Authorization header 的 raw key
 */
export async function seedApiKey(
  userId: string,
  balance: number = 10,
  options: {
    maxConcurrency?: number;
  } = {},
): Promise<string> {
  // 生成测试用 API Key
  const rawKey = `sk-gw-test-${userId}-${Date.now()}`;
  const keyHash = await hashKey(rawKey);

  // 存储 API Key 到 KV
  await env.KV.put(`apikey:${keyHash}`, userId, {
    metadata: {
      keyPrefix: `${rawKey.substring(0, 12)}...`,
      isActive: true,
      userId,
    },
  });

  // 存储用户数据到 KV
  await env.KV.put(
    `user:${userId}`,
    JSON.stringify({
      balance,
      concurrency: 0,
      isSuspended: false,
    }),
    {
      metadata: {
        email: `${userId}@test.com`,
        createdAt: new Date().toISOString(),
        maxConcurrency: options.maxConcurrency,
      },
    },
  );

  return rawKey;
}

/**
 * SHA256 哈希（与 src/lib/crypto.ts 中的 hashApiKey 一致）
 */
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
