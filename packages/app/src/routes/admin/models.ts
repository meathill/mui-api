import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { models } from '../../db/schema';
import { badRequest, notFound, zodErrorToApiError } from '../../lib/errors';
import { ModelCreateSchema, ModelUpdateSchema } from '../../lib/validators';
import { createProxyServices } from '../../services/service-factory';
import type { CloudflareBindings } from '../../types';

const modelRoutes = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * drizzle 会把 D1 的约束错误包进 DrizzleQueryError（message 是 SQL，真因在 cause 里），
 * 这里沿 cause 链找 UNIQUE，避免误报 500。
 */
function hasUniqueConstraintError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth++) {
    if (String(current).includes('UNIQUE')) return true;
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
}

/**
 * GET /admin/models
 * 列出所有模型
 */
modelRoutes.get('/', async (c) => {
  const db = c.get('db');
  const modelList = await db.select().from(models);
  return c.json({ success: true, models: modelList });
});

/**
 * POST /admin/models
 * 创建模型
 */
modelRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const result = ModelCreateSchema.safeParse(body);

  if (!result.success) {
    return c.json(zodErrorToApiError(result.error), 400);
  }

  const db = c.get('db');

  try {
    await db.insert(models).values(result.data);
    await createProxyServices(c.env, db).modelCatalog.refresh();
    return c.json({ success: true, model: result.data }, 201);
  } catch (error) {
    if (hasUniqueConstraintError(error)) {
      // models_normalized_id_unique 会把 dot/hyphen 等价写法视为同一模型。
      return badRequest(c, `模型 ${result.data.id} 已存在（点号/连字符等价写法视为同一模型）`);
    }
    throw error;
  }
});

/**
 * PUT /admin/models/:id
 * 更新模型
 */
modelRoutes.put('/:id', async (c) => {
  const modelId = c.req.param('id');
  const body = await c.req.json();
  const result = ModelUpdateSchema.safeParse(body);

  if (!result.success) {
    return c.json(zodErrorToApiError(result.error), 400);
  }

  const db = c.get('db');
  const existing = await db.select().from(models).where(eq(models.id, modelId)).get();
  if (!existing) {
    return notFound(c, `模型 ${modelId} 不存在`);
  }

  await db.update(models).set(result.data).where(eq(models.id, modelId));
  await createProxyServices(c.env, db).modelCatalog.refresh();

  return c.json({ success: true, model: { ...existing, ...result.data } });
});

/**
 * DELETE /admin/models/:id
 * 删除模型
 */
modelRoutes.delete('/:id', async (c) => {
  const modelId = c.req.param('id');
  const db = c.get('db');

  const existing = await db.select().from(models).where(eq(models.id, modelId)).get();
  if (!existing) {
    return notFound(c, `模型 ${modelId} 不存在`);
  }

  await db.delete(models).where(eq(models.id, modelId));
  await createProxyServices(c.env, db).modelCatalog.refresh();

  return c.json({ success: true, modelId });
});

export default modelRoutes;
