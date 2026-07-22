import type { CloudflareBindings, KVUserData, KVUserMetadata } from '../types';
import type { WalletReservation } from '../durable-objects/wallet';

export interface WalletRecord {
  data: KVUserData;
  metadata: KVUserMetadata;
}

interface WalletResponse {
  ok: boolean;
  error?: string;
  data?: KVUserData;
  metadata?: KVUserMetadata;
  reservation?: WalletReservation;
}

export class WalletServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = 'WalletServiceError';
  }
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

  async reserve(userId: string, reservationId: string, amount: number, expiresAt: number): Promise<WalletReservation> {
    return this.requestReservation(userId, '/reserve', { reservationId, amount, expiresAt });
  }

  async refreshReservation(userId: string, reservationId: string, expiresAt: number): Promise<WalletReservation> {
    return this.requestReservation(userId, '/refresh-reservation', { reservationId, expiresAt });
  }

  async settleReservation(userId: string, reservationId: string, amount: number): Promise<WalletReservation> {
    return this.requestReservation(userId, '/settle-reservation', { reservationId, amount });
  }

  async releaseReservation(userId: string, reservationId: string): Promise<WalletReservation> {
    return this.requestReservation(userId, '/release-reservation', { reservationId });
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

  /** 把 KV 展示镜像强制刷新为权威账本当前值（运维用） */
  async syncMirror(userId: string): Promise<WalletRecord> {
    return this.request(userId, '/sync-mirror', {});
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

  private async requestReservation(userId: string, path: string, payload: unknown): Promise<WalletReservation> {
    const stub = this.getStub(userId);
    const response = await stub.fetch(`https://wallet${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as WalletResponse;
    if (!response.ok || !result.ok || !result.reservation) {
      const code = result.error ?? 'unknown_error';
      throw new WalletServiceError(`钱包预占服务调用失败 (${response.status}): ${code}`, response.status, code);
    }
    return result.reservation;
  }

  private getStub(userId: string): DurableObjectStub {
    const id = this.env.WALLET.idFromName(userId);
    return this.env.WALLET.get(id);
  }
}
