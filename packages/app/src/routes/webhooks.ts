import { Hono } from 'hono';
import { createDb } from '../db';
import { handleStripeWebhook } from '../services/stripe-service';
import type { CloudflareBindings } from '../types';

const webhooks = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * POST /webhooks/stripe
 * 必须读 raw body 给 Stripe 做签名校验
 */
webhooks.post('/stripe', async (c) => {
  const rawBody = await c.req.raw.text();
  const signature = c.req.header('stripe-signature');
  const db = createDb(c.env.DB);
  const result = await handleStripeWebhook(c.env, db, rawBody, signature);
  return c.json(result.body, result.status as 200 | 400 | 503);
});

export default webhooks;
