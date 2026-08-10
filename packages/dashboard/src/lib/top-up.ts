export const TOP_UP_MINIMUM_AMOUNT = 10;
export const TOP_UP_AMOUNTS = [TOP_UP_MINIMUM_AMOUNT, 20, 50] as const;
export const TOP_UP_AMOUNT_ERROR_MESSAGE = '最低充值 $10，仅支持充值 $10、$20、$50';
export const TOP_UP_CURRENCY = 'USD';
export const STRIPE_TOP_UP_SOURCE = 'stripe_checkout';
// processing 超过该秒数视为 worker 硬终止残留（Workers 单请求生命周期远短于此），
// 允许被重新 claim 入账；双重入账仍由原子 claim + 流水复查 + UNIQUE(source, source_id) 兜底
export const TOP_UP_PROCESSING_STALE_SECONDS = 600;

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
