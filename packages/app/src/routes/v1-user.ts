import { Hono } from 'hono';
import { z } from 'zod';
import type { CloudflareBindings } from '../types';
import { readAuthMiddleware } from '../middleware/read-auth';
import { createDb, models } from '../db';
import { getBalanceSnapshot, listRecharges, listUsage } from '../services/wallet-query-service';
import { createTopupSession } from '../services/stripe-service';

const v1User = new Hono<{ Bindings: CloudflareBindings }>();

function specError(c: any, status: number, error: string, message: string) {
  return c.json({ error, message }, status);
}

/**
 * GET /v1/balance — muirouter-spec.md §2
 */
v1User.get('/balance', readAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env.DB);
  const snapshot = await getBalanceSnapshot(db, userId);
  return c.json(snapshot);
});

/**
 * GET /v1/usage — 当前用户用量明细分页
 */
v1User.get('/usage', readAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env.DB);
  const result = await listUsage(db, userId, {
    limit: c.req.query('limit'),
    cursor: c.req.query('cursor'),
    model: c.req.query('model'),
    from: c.req.query('from'),
    to: c.req.query('to'),
  });
  return c.json(result);
});

/**
 * GET /v1/recharges — 当前用户充值记录分页
 */
v1User.get('/recharges', readAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env.DB);
  const result = await listRecharges(db, userId, {
    limit: c.req.query('limit'),
    cursor: c.req.query('cursor'),
  });
  return c.json(result);
});

/**
 * GET /v1/public-models — 不鉴权的公开模型列表（含计价），第三方 dashboard 友好。
 * 注：标准的 GET /v1/models（OpenAI 兼容）保留在 openai 子应用上，需要 sk-gw- 鉴权，行为不变。
 */
v1User.get('/public-models', async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db.select().from(models);
  return c.json({
    items: rows.map((m) => ({
      id: m.id,
      provider: m.provider,
      upstream_model_id: m.upstreamModelId,
      input_price: m.inputPrice,
      output_price: m.outputPrice,
      markup_rate: m.markupRate ?? 1.2,
    })),
  });
});

const TopupSchema = z.object({
  amount_cents: z.number().int().positive().max(100_000_00),
  currency: z.string().length(3).optional(),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
});

/**
 * POST /v1/topup-sessions — 创建 Stripe checkout session
 */
v1User.post('/topup-sessions', readAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return specError(c, 400, 'invalid_request', '请求体必须是有效 JSON');
  }
  const parsed = TopupSchema.safeParse(body);
  if (!parsed.success) {
    return specError(c, 400, 'invalid_request', parsed.error.issues.map((i) => i.message).join('; '));
  }

  if (!c.env.STRIPE_SECRET_KEY) {
    return specError(c, 503, 'stripe_unconfigured', 'Stripe 充值通道未配置');
  }

  try {
    const result = await createTopupSession(c.env, createDb(c.env.DB), {
      userId,
      amountCents: parsed.data.amount_cents,
      currency: (parsed.data.currency ?? 'usd').toLowerCase(),
      successUrl: parsed.data.success_url,
      cancelUrl: parsed.data.cancel_url,
    });
    return c.json(result, 201);
  } catch (err) {
    console.error('topup-sessions failed:', err);
    return specError(c, 502, 'stripe_error', String(err instanceof Error ? err.message : err));
  }
});

export default v1User;
