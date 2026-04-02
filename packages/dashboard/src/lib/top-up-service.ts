import { and, eq } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type Stripe from 'stripe';
import { rechargeLogs, stripeTopupSessions } from '@/db/app-schema';
import { defaultLocale, locales, type Locale } from '@/i18n/config';
import { getDb } from '@/lib/db';
import { createEmailService } from '@/lib/email';
import {
  addBalance,
  createUser,
  getKV,
  getUserData,
  setUserData,
  type KVUserData,
  type KVUserMetadata,
} from '@/lib/kv';
import { getStripeClient } from '@/lib/stripe';
import {
  deriveTopUpStatus,
  parseTopUpAmount,
  STRIPE_TOP_UP_SOURCE,
  TOP_UP_CURRENCY,
  toStripeUnitAmount,
  type TopUpAmount,
  type TopUpSessionState,
  type TopUpStatus,
} from '@/lib/top-up';

interface SessionUser {
  id: string;
  email: string;
  name: string;
}

interface StripeTopUpMetadata {
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

export async function createTopUpCheckoutSession(params: {
  amount: number;
  locale?: string;
  origin: string;
  user: SessionUser;
}): Promise<CreateTopUpCheckoutResult> {
  const amount = parseTopUpAmount(params.amount);
  if (!amount) {
    throw new Error('仅支持充值 $10、$20、$50');
  }

  const locale = resolveLocale(params.locale);
  const { env } = await getCloudflareContext({ async: true });
  const stripe = getStripeClient(env.STRIPE_SECRET_KEY);
  const db = await getDb();
  const kv = await getKV();
  const customerId = await ensureStripeCustomerId(stripe, kv, params.user);
  const metadata = buildStripeMetadata({ amount, user: params.user });
  const successUrl = buildReturnUrl(params.origin, locale, '/app', {
    session_id: '{CHECKOUT_SESSION_ID}',
    topUp: 'success',
  });
  const cancelUrl = buildReturnUrl(params.origin, locale, '/app', {
    topUp: 'cancelled',
  });

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: params.user.id,
    customer: customerId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: toStripeUnitAmount(amount),
          product_data: {
            name: `MUI Router 余额充值 $${amount}`,
            description: '一次性充值，充多少得多少，余额不会过期。',
          },
        },
      },
    ],
    metadata,
    payment_intent_data: {
      metadata,
    },
  });

  await db.insert(stripeTopupSessions).values({
    checkoutSessionId: session.id,
    userId: params.user.id,
    amount,
    currency: TOP_UP_CURRENCY,
    status: 'created',
    paymentStatus: session.payment_status ?? null,
    stripeCustomerId: customerId,
    paymentIntentId: getStripeObjectId(session.payment_intent),
  });

  if (!session.url) {
    throw new Error('Stripe Checkout URL 生成失败');
  }

  return {
    sessionId: session.id,
    url: session.url,
  };
}

export async function getTopUpSessionStatus(params: {
  checkoutSessionId: string;
  userId: string;
}): Promise<TopUpSessionStatusResult> {
  const { env } = await getCloudflareContext({ async: true });
  const stripe = getStripeClient(env.STRIPE_SECRET_KEY);
  const db = await getDb();

  let row = await db.query.stripeTopupSessions.findFirst({
    where: eq(stripeTopupSessions.checkoutSessionId, params.checkoutSessionId),
  });

  if (!row) {
    const checkoutSession = await stripe.checkout.sessions.retrieve(params.checkoutSessionId);
    const metadata = readStripeMetadata(checkoutSession);
    if (metadata.userId !== params.userId) {
      throw new Error('无权查看该充值会话');
    }
    await syncTopUpSessionRecord(checkoutSession, metadata);
    row = await db.query.stripeTopupSessions.findFirst({
      where: eq(stripeTopupSessions.checkoutSessionId, params.checkoutSessionId),
    });
  }

  if (!row || row.userId !== params.userId) {
    throw new Error('充值会话不存在');
  }

  if (row.status !== 'credited' && row.status !== 'cancelled') {
    const checkoutSession = await stripe.checkout.sessions.retrieve(params.checkoutSessionId);
    const metadata = readStripeMetadata(checkoutSession);
    if (metadata.userId !== params.userId) {
      throw new Error('无权查看该充值会话');
    }

    await syncTopUpSessionRecord(checkoutSession, metadata);

    if (checkoutSession.payment_status === 'paid') {
      await fulfillTopUpCheckoutSession(params.checkoutSessionId);
    } else if (checkoutSession.status === 'expired') {
      await updateTopUpSessionState({
        checkoutSessionId: params.checkoutSessionId,
        paymentStatus: checkoutSession.payment_status ?? null,
        status: 'cancelled',
      });
    }

    row = await db.query.stripeTopupSessions.findFirst({
      where: eq(stripeTopupSessions.checkoutSessionId, params.checkoutSessionId),
    });
  }

  if (!row) {
    throw new Error('充值会话不存在');
  }

  return {
    amount: row.amount,
    balanceAfter: row.balanceAfter ?? null,
    paymentStatus: row.paymentStatus ?? null,
    sessionId: row.checkoutSessionId,
    status: deriveTopUpStatus({
      localStatus: row.status,
      checkoutStatus: row.status === 'cancelled' ? 'expired' : 'open',
      paymentStatus: row.paymentStatus ?? null,
    }),
  };
}

export async function fulfillTopUpCheckoutSession(checkoutSessionId: string): Promise<TopUpStatus> {
  const { env } = await getCloudflareContext({ async: true });
  const stripe = getStripeClient(env.STRIPE_SECRET_KEY);
  const db = await getDb();
  const kv = await getKV();

  const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId);
  const metadata = readStripeMetadata(checkoutSession);

  await syncTopUpSessionRecord(checkoutSession, metadata);

  const currentSession = await db.query.stripeTopupSessions.findFirst({
    where: eq(stripeTopupSessions.checkoutSessionId, checkoutSessionId),
  });

  if (currentSession?.status === 'credited') {
    return 'credited';
  }

  if (checkoutSession.status === 'expired') {
    await updateTopUpSessionState({
      checkoutSessionId,
      paymentStatus: checkoutSession.payment_status ?? null,
      status: 'cancelled',
    });
    return 'cancelled';
  }

  if (checkoutSession.payment_status !== 'paid') {
    return 'processing';
  }

  const claimed = await claimTopUpProcessing(checkoutSessionId, checkoutSession.payment_status ?? null);
  if (!claimed) {
    const latestSession = await db.query.stripeTopupSessions.findFirst({
      where: eq(stripeTopupSessions.checkoutSessionId, checkoutSessionId),
    });

    return deriveTopUpStatus({
      localStatus: latestSession?.status ?? null,
      checkoutStatus: checkoutSession.status ?? null,
      paymentStatus: checkoutSession.payment_status ?? null,
    });
  }

  try {
    const existingRecharge = await db.query.rechargeLogs.findFirst({
      where: and(eq(rechargeLogs.source, STRIPE_TOP_UP_SOURCE), eq(rechargeLogs.sourceId, checkoutSessionId)),
    });

    if (existingRecharge) {
      await updateTopUpSessionState({
        balanceAfter: existingRecharge.balanceAfter ?? null,
        checkoutSessionId,
        completedAt: new Date(),
        paymentIntentId: getStripeObjectId(checkoutSession.payment_intent),
        paymentStatus: checkoutSession.payment_status ?? null,
        status: 'credited',
        stripeCustomerId: getStripeObjectId(checkoutSession.customer),
      });
      return 'credited';
    }

    await ensureUserRecord(kv, metadata.userId, metadata.userEmail);
    const newBalance = await addBalance(kv, metadata.userId, metadata.amount);

    await db.insert(rechargeLogs).values({
      id: crypto.randomUUID(),
      userId: metadata.userId,
      operatorId: null,
      amount: metadata.amount,
      balanceAfter: newBalance,
      source: STRIPE_TOP_UP_SOURCE,
      sourceId: checkoutSessionId,
      note: 'Stripe Checkout 自动充值',
    });

    await updateTopUpSessionState({
      balanceAfter: newBalance,
      checkoutSessionId,
      completedAt: new Date(),
      lastError: null,
      paymentIntentId: getStripeObjectId(checkoutSession.payment_intent),
      paymentStatus: checkoutSession.payment_status ?? null,
      status: 'credited',
      stripeCustomerId: getStripeObjectId(checkoutSession.customer),
    });

    await sendRechargeEmailIfConfigured(metadata.userEmail, metadata.amount, newBalance);
    return 'credited';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe 充值处理失败';
    await updateTopUpSessionState({
      checkoutSessionId,
      lastError: message,
      paymentStatus: checkoutSession.payment_status ?? null,
      status: 'failed',
    });
    throw error;
  }
}

function buildStripeMetadata(params: { amount: TopUpAmount; user: SessionUser }): Record<string, string> {
  return {
    topUpAmount: String(params.amount),
    type: 'wallet_top_up',
    userEmail: params.user.email,
    userId: params.user.id,
  };
}

function buildReturnUrl(origin: string, locale: Locale, pathname: string, params?: Record<string, string>): string {
  const url = new URL(getLocalizedPath(locale, pathname), origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

async function claimTopUpProcessing(checkoutSessionId: string, paymentStatus: string | null): Promise<boolean> {
  const { env } = await getCloudflareContext({ async: true });
  const result = await env.DB.prepare(
    `
      UPDATE stripe_topup_sessions
      SET status = 'processing',
          payment_status = ?,
          updated_at = unixepoch(),
          last_error = NULL
      WHERE checkout_session_id = ?
        AND status IN ('created', 'failed')
    `,
  )
    .bind(paymentStatus, checkoutSessionId)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

async function ensureStripeCustomerId(stripe: Stripe, kv: KVNamespace, user: SessionUser): Promise<string> {
  const existing = await ensureUserRecord(kv, user.id, user.email);
  if (existing.metadata.stripeCustomerId) {
    return existing.metadata.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: {
      userId: user.id,
    },
    name: user.name,
  });

  await setUserData(kv, user.id, existing.data, {
    ...existing.metadata,
    stripeCustomerId: customer.id,
  });

  return customer.id;
}

async function ensureUserRecord(
  kv: KVNamespace,
  userId: string,
  email: string,
): Promise<{ data: KVUserData; metadata: KVUserMetadata }> {
  const existing = await getUserData(kv, userId);
  if (existing.data && existing.metadata) {
    return {
      data: existing.data,
      metadata: existing.metadata,
    };
  }

  await createUser(kv, userId, email);
  const created = await getUserData(kv, userId);
  if (!created.data || !created.metadata) {
    throw new Error('初始化用户余额记录失败');
  }

  return {
    data: created.data,
    metadata: created.metadata,
  };
}

function getLocalizedPath(locale: Locale, pathname: string): string {
  if (locale === defaultLocale) {
    return pathname;
  }

  return `/${locale}${pathname}`;
}

function getStripeObjectId(value: string | { id: string } | null): string | null {
  if (!value) {
    return null;
  }

  return typeof value === 'string' ? value : value.id;
}

function readStripeMetadata(checkoutSession: Stripe.Checkout.Session): StripeTopUpMetadata {
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

function resolveLocale(locale?: string): Locale {
  if (locale && locales.includes(locale as Locale)) {
    return locale as Locale;
  }

  return defaultLocale;
}

async function sendRechargeEmailIfConfigured(email: string, amount: number, newBalance: number): Promise<void> {
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

async function syncTopUpSessionRecord(
  checkoutSession: Stripe.Checkout.Session,
  metadata: StripeTopUpMetadata,
): Promise<void> {
  const { env } = await getCloudflareContext({ async: true });
  const paymentIntentId = getStripeObjectId(checkoutSession.payment_intent);
  const stripeCustomerId = getStripeObjectId(checkoutSession.customer);

  await env.DB.prepare(
    `
      INSERT OR IGNORE INTO stripe_topup_sessions (
        checkout_session_id,
        user_id,
        amount,
        currency,
        status,
        payment_status,
        stripe_customer_id,
        payment_intent_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, 'created', ?, ?, ?, unixepoch(), unixepoch())
    `,
  )
    .bind(
      checkoutSession.id,
      metadata.userId,
      metadata.amount,
      TOP_UP_CURRENCY,
      checkoutSession.payment_status ?? null,
      stripeCustomerId,
      paymentIntentId,
    )
    .run();

  await updateTopUpSessionState({
    checkoutSessionId: checkoutSession.id,
    paymentIntentId,
    paymentStatus: checkoutSession.payment_status ?? null,
    stripeCustomerId,
  });
}

async function updateTopUpSessionState(params: {
  balanceAfter?: number | null;
  checkoutSessionId: string;
  completedAt?: Date | null;
  lastError?: string | null;
  paymentIntentId?: string | null;
  paymentStatus?: string | null;
  status?: TopUpSessionState;
  stripeCustomerId?: string | null;
}): Promise<void> {
  const db = await getDb();

  await db
    .update(stripeTopupSessions)
    .set({
      balanceAfter: params.balanceAfter,
      completedAt: params.completedAt ?? undefined,
      lastError: params.lastError,
      paymentIntentId: params.paymentIntentId,
      paymentStatus: params.paymentStatus,
      status: params.status,
      stripeCustomerId: params.stripeCustomerId,
      updatedAt: new Date(),
    })
    .where(eq(stripeTopupSessions.checkoutSessionId, params.checkoutSessionId));
}
