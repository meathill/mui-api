import type { KVUserData, KVUserMetadata } from '../types';

// WalletDO 请求/响应形状。从 wallet.ts 抽出以控制单文件长度。

export interface CreateRequest {
  email: string;
  initialBalance?: number;
}

export interface AmountRequest {
  amount: number;
}

export interface ReservationRequest {
  reservationId: string;
  amount?: number;
  expiresAt?: number;
}

export interface WalletReservation {
  reservationId: string;
  amount: number;
  status: 'reserved' | 'settled' | 'released';
  expiresAt: number;
  settledAmount?: number;
}

export type SetMetadataRequest = Pick<KVUserMetadata, 'maxConcurrency' | 'rateMultiplier' | 'stripeCustomerId'>;

export interface WalletResponse {
  ok: boolean;
  error?: string;
  data?: KVUserData;
  metadata?: KVUserMetadata;
  reservation?: WalletReservation;
}
