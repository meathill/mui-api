import { getCloudflareContext } from '@opennextjs/cloudflare';
import { and, eq } from 'drizzle-orm';
import { rechargeLogs, stripeTopupSessions } from '@/db/app-schema';
import { getDb } from '@/lib/db';
import { addBalance, getKV } from '@/lib/kv';
import { getStripeClient } from '@/lib/stripe';
import {
  deriveTopUpStatus,
  parseTopUpAmount,
  STRIPE_TOP_UP_SOURCE,
  TOP_UP_CURRENCY,
  type TopUpStatus,
  toStripeUnitAmount,
} from '@/lib/top-up';
import {
  claimTopUpProcessing,
  ensureStripeCustomerId,
  ensureUserRecord,
  syncTopUpSessionRecord,
  updateTopUpSessionState,
} from './db';
import type { CreateTopUpCheckoutResult, SessionUser, TopUpSessionStatusResult } from './types';
import {
  buildReturnUrl,
  buildStripeMetadata,
  getStripeObjectId,
  readStripeMetadata,
  resolveLocale,
  sendRechargeEmailIfConfigured,
} from './utils';

export * from './types';

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
