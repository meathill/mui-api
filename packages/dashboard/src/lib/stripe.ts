import Stripe from 'stripe';

let stripeClient: Stripe | null = null;
let cryptoProvider: Stripe.CryptoProvider | null = null;

export function getStripeClient(secretKey: string): Stripe {
  if (stripeClient) {
    return stripeClient;
  }

  stripeClient = new Stripe(secretKey, {
    apiVersion: '2026-07-29.dahlia',
    appInfo: {
      name: 'mui-dashboard',
    },
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
  });

  return stripeClient;
}

export function getStripeWebhookCryptoProvider(): Stripe.CryptoProvider {
  if (cryptoProvider) {
    return cryptoProvider;
  }

  cryptoProvider = Stripe.createSubtleCryptoProvider();
  return cryptoProvider;
}
