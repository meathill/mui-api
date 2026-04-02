import { describe, expect, it } from 'vitest';
import { deriveTopUpStatus, parseTopUpAmount, toStripeUnitAmount } from './top-up';

describe('top-up helpers', () => {
  it('should only accept fixed top-up amounts', () => {
    expect(parseTopUpAmount(10)).toBe(10);
    expect(parseTopUpAmount(20)).toBe(20);
    expect(parseTopUpAmount(50)).toBe(50);
    expect(parseTopUpAmount(5)).toBeNull();
    expect(parseTopUpAmount('10')).toBeNull();
  });

  it('should convert dollars to Stripe cents', () => {
    expect(toStripeUnitAmount(10)).toBe(1000);
    expect(toStripeUnitAmount(20)).toBe(2000);
    expect(toStripeUnitAmount(50)).toBe(5000);
  });

  it('should derive final credited status from local record', () => {
    expect(
      deriveTopUpStatus({
        localStatus: 'credited',
        checkoutStatus: 'complete',
        paymentStatus: 'paid',
      }),
    ).toBe('credited');
  });

  it('should keep a paid but uncredited session in processing state', () => {
    expect(
      deriveTopUpStatus({
        localStatus: 'processing',
        checkoutStatus: 'complete',
        paymentStatus: 'paid',
      }),
    ).toBe('processing');
  });

  it('should mark expired sessions as cancelled', () => {
    expect(
      deriveTopUpStatus({
        localStatus: 'created',
        checkoutStatus: 'expired',
        paymentStatus: 'unpaid',
      }),
    ).toBe('cancelled');
  });
});
