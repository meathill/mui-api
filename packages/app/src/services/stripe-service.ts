import { generateId } from '@muirouter/shared-db/crypto';
import { fromCents } from '@muirouter/shared-db/money';
import { eq, sql } from 'drizzle-orm';
import Stripe from 'stripe';
import type { Database } from '../db';
import { rechargeLogs, stripeTopupSessions, wallets } from '../db';
import type { CloudflareBindings } from '../types';
import { WalletService } from './wallet-service';

interface CreateTopupArgs {
  userId: string;
  amountCents: number;
  currency: string; // 小写 ISO 4217
  successUrl?: string;
  cancelUrl?: string;
}

interface CreateTopupResult {
  url: string;
  session_id: string;
  amount_cents: number;
  currency: string;
}

/**
 * 在 Cloudflare Workers 环境中实例化 Stripe SDK
 * - 必须用 fetch http client（runtime 没有 node http）
 */
function makeStripe(env: CloudflareBindings): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY 未配置');
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    apiVersion: '2026-03-25.dahlia',
  });
}

export async function createTopupSession(
  env: CloudflareBindings,
  db: Database,
  args: CreateTopupArgs,
): Promise<CreateTopupResult> {
  const stripe = makeStripe(env);
  const successUrl = args.successUrl ?? env.STRIPE_DEFAULT_SUCCESS_URL ?? `${env.BASE_URL}/topup/success`;
  const cancelUrl = args.cancelUrl ?? env.STRIPE_DEFAULT_CANCEL_URL ?? `${env.BASE_URL}/topup/cancel`;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: args.currency,
          product_data: { name: `muirouter 余额充值` },
          unit_amount: args.amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: { userId: args.userId },
    client_reference_id: args.userId,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  await db.insert(stripeTopupSessions).values({
    checkoutSessionId: session.id,
    userId: args.userId,
    amount: fromCents(args.amountCents, args.currency),
    currency: args.currency.toUpperCase(),
    status: 'created',
  });

  return {
    url: session.url ?? '',
    session_id: session.id,
    amount_cents: args.amountCents,
    currency: args.currency.toUpperCase(),
  };
}

export interface WebhookHandleResult {
  status: number;
  body: { received: boolean; processed?: boolean; reason?: string };
}

export async function handleStripeWebhook(
  env: CloudflareBindings,
  db: Database,
  rawBody: string,
  signature: string | undefined,
): Promise<WebhookHandleResult> {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return { status: 503, body: { received: false, reason: 'webhook 未配置' } };
  }
  if (!signature) {
    return { status: 400, body: { received: false, reason: '缺少 Stripe-Signature' } };
  }

  const stripe = makeStripe(env);
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return { status: 400, body: { received: false, reason: `签名校验失败: ${(err as Error).message}` } };
  }

  if (event.type !== 'checkout.session.completed') {
    return { status: 200, body: { received: true, processed: false, reason: `未处理事件: ${event.type}` } };
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const sessionId = session.id;
  const userId = session.metadata?.userId ?? session.client_reference_id ?? null;
  if (!userId) {
    return { status: 200, body: { received: true, processed: false, reason: '会话缺少 userId' } };
  }

  // 幂等：若 session 已 completed，不重复入账
  const existing = await db.query.stripeTopupSessions.findFirst({
    where: eq(stripeTopupSessions.checkoutSessionId, sessionId),
  });
  if (existing?.status === 'completed') {
    return { status: 200, body: { received: true, processed: false, reason: '已处理' } };
  }

  const currency = (session.currency ?? existing?.currency ?? 'usd').toUpperCase();
  const amount = fromCents(session.amount_total ?? 0, currency);
  if (amount <= 0) {
    return { status: 200, body: { received: true, processed: false, reason: 'amount=0' } };
  }

  // 1) 累加 wallets.balance（若不存在则新建）
  const updated = await db
    .update(wallets)
    .set({ balance: sql`COALESCE(${wallets.balance}, 0) + ${amount}`, updatedAt: new Date() })
    .where(eq(wallets.userId, userId))
    .returning({ balance: wallets.balance });
  let balanceAfter = updated[0]?.balance ?? null;
  if (!updated.length) {
    await db.insert(wallets).values({ userId, balance: amount, currency });
    balanceAfter = amount;
  }

  // 2) 写 recharge_logs
  await db.insert(rechargeLogs).values({
    id: generateId(),
    userId,
    operatorId: null,
    amount,
    balanceAfter,
    source: 'stripe',
    sourceId: sessionId,
    note: 'Stripe checkout',
  });

  // 3) 标记 session
  await db
    .update(stripeTopupSessions)
    .set({
      status: 'completed',
      paymentStatus: session.payment_status ?? 'paid',
      paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
      balanceAfter,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(stripeTopupSessions.checkoutSessionId, sessionId));

  // 4) 钱包同步：WalletDO 是 user:{userId} 记录的唯一权威写者，同时会自动维护 KV 展示镜像。
  // 若用户还没有任何钱包记录（理论上不会发生——发起充值前必然已通过 API/dashboard 触发过懒初始化），
  // 静默跳过，不让 webhook 因此 500 给 Stripe 触发无意义重试。
  try {
    const walletService = new WalletService(env);
    await walletService.add(userId, amount);
  } catch (err) {
    console.error('Stripe webhook 钱包同步失败:', err);
  }

  return { status: 200, body: { received: true, processed: true } };
}
