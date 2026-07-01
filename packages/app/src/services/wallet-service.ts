import type { CloudflareBindings, KVUserData, KVUserMetadata } from '../types';

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

/**
 * WalletDO 的调用封装（写路径）。与只读查询用的 wallet-query-service.ts 区分开。
 */
export class WalletService {
  constructor(private env: Pick<CloudflareBindings, 'WALLET'>) {}

  async create(userId: string, email: string, initialBalance = 0): Promise<WalletRecord> {
    return this.request(userId, '/create', { email, initialBalance });
  }

  async deduct(userId: string, amount: number): Promise<WalletRecord> {
    return this.request(userId, '/deduct', { amount });
  }

  async add(userId: string, amount: number): Promise<WalletRecord> {
    return this.request(userId, '/add', { amount });
  }

  async consumeFreeQuota(userId: string, amount: number): Promise<WalletRecord> {
    return this.request(userId, '/consume-free-quota', { amount });
  }

  async suspend(userId: string): Promise<WalletRecord> {
    return this.request(userId, '/suspend', {});
  }

  async unsuspend(userId: string): Promise<WalletRecord> {
    return this.request(userId, '/unsuspend', {});
  }

  async setMetadata(
    userId: string,
    patch: Pick<KVUserMetadata, 'maxConcurrency' | 'rateMultiplier' | 'stripeCustomerId'>,
  ): Promise<WalletRecord> {
    return this.request(userId, '/set-metadata', patch);
  }

  private async request(userId: string, path: string, payload: unknown): Promise<WalletRecord> {
    const stub = this.getStub(userId);
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

  private getStub(userId: string): DurableObjectStub {
    const id = this.env.WALLET.idFromName(userId);
    return this.env.WALLET.get(id);
  }
}
