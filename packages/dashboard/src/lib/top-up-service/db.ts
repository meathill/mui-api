import { getCloudflareContext } from '@opennextjs/cloudflare';
import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { stripeTopupSessions } from '@/db/app-schema';
import { getDb } from '@/lib/db';
import { getUserData, type KVUserData, type KVUserMetadata } from '@/lib/kv';
import { TOP_UP_CURRENCY, TOP_UP_PROCESSING_STALE_SECONDS, type TopUpSessionState } from '@/lib/top-up';
import { createWalletUser, setWalletMetadata } from '@/lib/wallet-do';
import type { SessionUser, StripeTopUpMetadata } from './types';
import { getStripeObjectId } from './utils';

export async function ensureUserRecord(
  kv: KVNamespace,
  wallet: DurableObjectNamespace,
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

  return createWalletUser(wallet, userId, email);
}

export async function ensureStripeCustomerId(
  stripe: Stripe,
  kv: KVNamespace,
  wallet: DurableObjectNamespace,
  user: SessionUser,
): Promise<string> {
  const existing = await ensureUserRecord(kv, wallet, user.id, user.email);
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

  await setWalletMetadata(wallet, user.id, { stripeCustomerId: customer.id });

  return customer.id;
}

export async function claimTopUpProcessing(checkoutSessionId: string, paymentStatus: string | null): Promise<boolean> {
  const { env } = await getCloudflareContext({ async: true });
  const result = await env.DB.prepare(
    `
      UPDATE stripe_topup_sessions
      SET status = 'processing',
          payment_status = ?,
          updated_at = unixepoch(),
          last_error = NULL
      WHERE checkout_session_id = ?
        AND (
          status IN ('created', 'failed')
          OR (status = 'processing' AND updated_at <= unixepoch() - ?)
        )
    `,
  )
    .bind(paymentStatus, checkoutSessionId, TOP_UP_PROCESSING_STALE_SECONDS)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

export async function syncTopUpSessionRecord(
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

export async function updateTopUpSessionState(params: {
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
