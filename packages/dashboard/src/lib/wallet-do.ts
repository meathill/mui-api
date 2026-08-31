/**
 * WalletDO 的调用封装（写路径）。与 packages/app 的 wallet-service.ts 逻辑一致，
 * 按 lib/kv.ts 已有的「各自维护一份、不新增跨包依赖」惯例复制一份，而不是共享包。
 * DO 类由 packages/app 导出/拥有，这里通过跨 Worker 绑定（wrangler.jsonc script_name）引用。
 */
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { KVUserData, KVUserMetadata } from './kv';

export async function getWallet(): Promise<DurableObjectNamespace> {
  const { env } = await getCloudflareContext({ async: true });
  return env.WALLET;
}

export interface WalletRecord {
  data: KVUserData;
  metadata: KVUserMetadata;
}

interface WalletResponse {
  ok: boolean;
  error?: string;
  data?: KVUserData;
  metadata?: KVUserMetadata;
}

async function callWallet(
  wallet: DurableObjectNamespace,
  userId: string,
  path: string,
  payload: unknown,
): Promise<WalletRecord> {
  const id = wallet.idFromName(userId);
  const stub = wallet.get(id);
  const response = await stub.fetch(`https://wallet${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify(payload),
  });

  const result = (await response.json()) as WalletResponse;
  if (!response.ok || !result.ok || !result.data || !result.metadata) {
    throw new Error(`钱包服务调用失败 (${response.status}): ${result.error ?? 'unknown_error'}`);
  }
  return { data: result.data, metadata: result.metadata };
}

export async function createWalletUser(
  wallet: DurableObjectNamespace,
  userId: string,
  email: string,
  initialBalance = 0,
): Promise<WalletRecord> {
  return callWallet(wallet, userId, '/create', { email, initialBalance });
}

export async function addWalletBalance(
  wallet: DurableObjectNamespace,
  userId: string,
  amount: number,
): Promise<WalletRecord> {
  return callWallet(wallet, userId, '/add', { amount });
}

export async function unsuspendWalletUser(wallet: DurableObjectNamespace, userId: string): Promise<WalletRecord> {
  return callWallet(wallet, userId, '/unsuspend', {});
}

export async function setWalletMetadata(
  wallet: DurableObjectNamespace,
  userId: string,
  patch: Pick<KVUserMetadata, 'maxConcurrency' | 'rateMultiplier' | 'stripeCustomerId'>,
): Promise<WalletRecord> {
  return callWallet(wallet, userId, '/set-metadata', patch);
}

export async function syncWalletMirror(wallet: DurableObjectNamespace, userId: string): Promise<WalletRecord | null> {
  try {
    return await callWallet(wallet, userId, '/sync-mirror', {});
  } catch {
    return null;
  }
}

export async function getWalletRecord(wallet: DurableObjectNamespace, userId: string): Promise<WalletRecord | null> {
  return syncWalletMirror(wallet, userId);
}
