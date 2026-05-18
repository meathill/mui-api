import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDb } from '../../db';
import { models } from '../../db/schema';
import { badRequest, notFound, zodErrorToApiError } from '../../lib/errors';
import { ModelCreateSchema, ModelUpdateSchema } from '../../lib/validators';
import { createProxyServices } from '../../services/service-factory';
import type { CloudflareBindings } from '../../types';

const modelRoutes = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * GET /admin/models
 * 列出所有模型
 */
modelRoutes.get('/', async (c) => {
  const db = createDb(c.env.DB);
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

  const db = createDb(c.env.DB);

  try {
    await db.insert(models).values(result.data);
    await createProxyServices(c.env).modelCatalog.refresh();
    return c.json({ success: true, model: result.data }, 201);
  } catch (error) {
    if (String(error).includes('UNIQUE')) {
      return badRequest(c, `模型 ${result.data.id} 已存在`);
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

  const db = createDb(c.env.DB);
  const existing = await db.select().from(models).where(eq(models.id, modelId)).get();
  if (!existing) {
    return notFound(c, `模型 ${modelId} 不存在`);
  }

  await db.update(models).set(result.data).where(eq(models.id, modelId));
  await createProxyServices(c.env).modelCatalog.refresh();

  return c.json({ success: true, model: { ...existing, ...result.data } });
});

/**
 * DELETE /admin/models/:id
 * 删除模型
 */
modelRoutes.delete('/:id', async (c) => {
  const modelId = c.req.param('id');
  const db = createDb(c.env.DB);

  const existing = await db.select().from(models).where(eq(models.id, modelId)).get();
  if (!existing) {
    return notFound(c, `模型 ${modelId} 不存在`);
  }

  await db.delete(models).where(eq(models.id, modelId));
  await createProxyServices(c.env).modelCatalog.refresh();

  return c.json({ success: true, modelId });
});

export default modelRoutes;
