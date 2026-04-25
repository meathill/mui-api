import type { TopUpAmount, TopUpStatus } from '@/lib/top-up';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export interface StripeTopUpMetadata {
  amount: TopUpAmount;
  userEmail: string;
  userId: string;
}

export interface CreateTopUpCheckoutResult {
  sessionId: string;
  url: string;
}

export interface TopUpSessionStatusResult {
  amount: number;
  balanceAfter: number | null;
  paymentStatus: string | null;
  sessionId: string;
  status: TopUpStatus;
}
