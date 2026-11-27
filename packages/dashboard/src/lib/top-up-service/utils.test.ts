import type Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { STRIPE_CHECKOUT_SESSION_ID_PLACEHOLDER } from '@/lib/top-up';
import { buildReturnUrl, readStripeMetadata } from './utils';

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

describe('buildReturnUrl', () => {
  it('默认语言生成不带前缀的回调 URL 并保留 Stripe 占位符字面量', () => {
    expect(
      buildReturnUrl('https://muirouter.com', 'en', '/app', {
        session_id: STRIPE_CHECKOUT_SESSION_ID_PLACEHOLDER,
        topUp: 'success',
      }),
    ).toBe('https://muirouter.com/app?session_id={CHECKOUT_SESSION_ID}&topUp=success');
  });

  it('非默认语言生成带语言前缀的回调 URL 并保留 Stripe 占位符字面量', () => {
    expect(
      buildReturnUrl('https://muirouter.com', 'zh', '/app', {
        session_id: STRIPE_CHECKOUT_SESSION_ID_PLACEHOLDER,
        topUp: 'success',
      }),
    ).toBe('https://muirouter.com/zh/app?session_id={CHECKOUT_SESSION_ID}&topUp=success');
  });

  it('其他参数中的特殊字符仍然正常进行 URL 百分号编码', () => {
    expect(
      buildReturnUrl('https://muirouter.com', 'zh', '/app', {
        note: '{other} & test',
        session_id: STRIPE_CHECKOUT_SESSION_ID_PLACEHOLDER,
      }),
    ).toBe('https://muirouter.com/zh/app?note=%7Bother%7D+%26+test&session_id={CHECKOUT_SESSION_ID}');
  });
});
