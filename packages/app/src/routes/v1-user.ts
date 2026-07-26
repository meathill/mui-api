import { Hono } from 'hono';
import { models } from '../db';
import { readAuthMiddleware } from '../middleware/read-auth';
import { getBalanceSnapshot, listRecharges, listUsage } from '../services/wallet-query-service';
import type { CloudflareBindings } from '../types';

const v1User = new Hono<{ Bindings: CloudflareBindings }>();

function specError(c: any, status: number, error: string, message: string) {
  return c.json({ error, message }, status);
}

/**
 * GET /v1/balance — muirouter-spec.md §2
 */
v1User.get('/balance', readAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const snapshot = await getBalanceSnapshot(db, userId, c.env.KV);
  return c.json(snapshot);
});

/**
 * GET /v1/usage — 当前用户用量明细分页
 */
v1User.get('/usage', readAuthMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
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
  const db = c.get('db');
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
  const db = c.get('db');
  const rows = await db.select().from(models);
  return c.json({
    // 既有字段保持不变（第三方 dashboard 在用），元数据只做加法。
    items: rows.map((m) => ({
      id: m.id,
      provider: m.provider,
      upstream_model_id: m.upstreamModelId,
      input_price: m.inputPrice,
      output_price: m.outputPrice,
      markup_rate: m.markupRate ?? 1.2,
      display_name: m.displayName,
      context_length: m.contextLength,
      max_output_tokens: m.maxOutputTokens,
    })),
  });
});

export default v1User;
