export const TOP_UP_AMOUNTS = [10, 20, 50] as const;
export const TOP_UP_CURRENCY = 'USD';
export const STRIPE_TOP_UP_SOURCE = 'stripe_checkout';

export type TopUpAmount = (typeof TOP_UP_AMOUNTS)[number];
export type TopUpSessionState = 'created' | 'processing' | 'credited' | 'failed' | 'cancelled';
export type TopUpStatus = 'open' | 'processing' | 'credited' | 'failed' | 'cancelled';

export function isTopUpAmount(value: number): value is TopUpAmount {
  return TOP_UP_AMOUNTS.includes(value as TopUpAmount);
}

export function parseTopUpAmount(value: unknown): TopUpAmount | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return isTopUpAmount(value) ? value : null;
}

export function toStripeUnitAmount(amount: TopUpAmount): number {
  return amount * 100;
}

export function deriveTopUpStatus(params: {
  localStatus: string | null;
  checkoutStatus: string | null;
  paymentStatus: string | null;
}): TopUpStatus {
  const { localStatus, checkoutStatus, paymentStatus } = params;

  if (localStatus === 'credited') {
    return 'credited';
  }

  if (localStatus === 'failed') {
    return 'failed';
  }

  if (localStatus === 'cancelled' || checkoutStatus === 'expired') {
    return 'cancelled';
  }

  if (localStatus === 'processing' || paymentStatus === 'paid') {
    return 'processing';
  }

  return 'open';
}
