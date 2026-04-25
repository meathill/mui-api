import { getCloudflareContext } from '@opennextjs/cloudflare';
import { NextResponse } from 'next/server';
import { getStripeClient, getStripeWebhookCryptoProvider } from '@/lib/stripe';
import { fulfillTopUpCheckoutSession } from '@/lib/top-up-service';

export async function POST(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return NextResponse.json({ error: '缺少 Stripe 签名' }, { status: 400 });
    }

    const payload = await request.text();
    const stripe = getStripeClient(env.STRIPE_SECRET_KEY);
    const event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      getStripeWebhookCryptoProvider(),
    );

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      await fulfillTopUpCheckoutSession(event.data.object.id);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('POST /api/stripe/webhook 错误:', error);
    const message = error instanceof Error ? error.message : 'Webhook 处理失败';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
