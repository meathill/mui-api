import { getCloudflareContext } from '@opennextjs/cloudflare';
import type Stripe from 'stripe';
import { defaultLocale, type Locale, locales } from '@/i18n/config';
import { createEmailService } from '@/lib/email';
import { parseTopUpAmount, TOP_UP_CURRENCY, toStripeUnitAmount } from '@/lib/top-up';
import type { SessionUser, StripeTopUpMetadata } from './types';

export function buildStripeMetadata(params: { amount: number; user: SessionUser }): Record<string, string> {
  return {
    topUpAmount: String(params.amount),
    type: 'wallet_top_up',
    userEmail: params.user.email,
    userId: params.user.id,
  };
}

export function buildReturnUrl(
  origin: string,
  locale: Locale,
  pathname: string,
  params?: Record<string, string>,
): string {
  const url = new URL(getLocalizedPath(locale, pathname), origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export function getLocalizedPath(locale: Locale, pathname: string): string {
  if (locale === defaultLocale) {
    return pathname;
  }
  return `/${locale}${pathname}`;
}

export function resolveLocale(locale?: string): Locale {
  if (locale && locales.includes(locale as Locale)) {
    return locale as Locale;
  }
  return defaultLocale;
}

export function getStripeObjectId(value: string | { id: string } | null): string | null {
  if (!value) {
    return null;
  }
  return typeof value === 'string' ? value : value.id;
}

export function readStripeMetadata(checkoutSession: Stripe.Checkout.Session): StripeTopUpMetadata {
  const userId = checkoutSession.metadata?.userId;
  const userEmail =
    checkoutSession.metadata?.userEmail ?? checkoutSession.customer_details?.email ?? checkoutSession.customer_email;
  const amount = parseTopUpAmount(Number(checkoutSession.metadata?.topUpAmount));

  if (!userId || !userEmail || !amount) {
    throw new Error('Stripe Checkout metadata 不完整');
  }

  if (checkoutSession.amount_total !== toStripeUnitAmount(amount)) {
    throw new Error('Stripe Checkout 金额校验失败');
  }

  if ((checkoutSession.currency ?? '').toUpperCase() !== TOP_UP_CURRENCY) {
    throw new Error('Stripe Checkout 币种校验失败');
  }

  return {
    amount,
    userEmail,
    userId,
  };
}

export async function sendRechargeEmailIfConfigured(email: string, amount: number, newBalance: number): Promise<void> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.RESEND_API_KEY) {
    return;
  }

  const emailService = createEmailService({
    apiKey: env.RESEND_API_KEY,
    fromEmail: env.FROM_EMAIL,
  });

  await emailService.sendRechargeSuccessEmail(email, amount, newBalance);
}
