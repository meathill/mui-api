import type Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { readStripeMetadata } from './utils';

function makeCheckoutSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    amount_total: 1_000,
    currency: 'usd',
    customer_details: null,
    customer_email: null,
    metadata: {
      topUpAmount: '10',
      userEmail: 'user@example.com',
      userId: 'user-1',
    },
    ...overrides,
  } as Stripe.Checkout.Session;
}

describe('readStripeMetadata', () => {
  it('只接受 metadata、Stripe 金额和币种完全一致的充值', () => {
    expect(readStripeMetadata(makeCheckoutSession())).toEqual({
      amount: 10,
      userEmail: 'user@example.com',
      userId: 'user-1',
    });
  });

  it('拒绝被篡改的 Stripe 金额', () => {
    expect(() => readStripeMetadata(makeCheckoutSession({ amount_total: 900 }))).toThrow(
      'Stripe Checkout 金额校验失败',
    );
  });

  it('拒绝非 USD 充值', () => {
    expect(() => readStripeMetadata(makeCheckoutSession({ currency: 'eur' }))).toThrow('Stripe Checkout 币种校验失败');
  });
});
