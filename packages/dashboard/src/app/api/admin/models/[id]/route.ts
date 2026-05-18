import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { models } from '@/db/app-schema';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/lib/db';
import { getKV, invalidateModelsCatalog } from '@/lib/kv';
import { validateModelBody } from '../route';

/**
 * PUT /api/admin/models/:id — 更新模型
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const { id: modelId } = await params;
    const body = (await request.json()) as Parameters<typeof validateModelBody>[0];
    const db = await getDb();

    const validationError = validateModelBody(body);
    if (validationError) return validationError;

    const existing = await db.select().from(models).where(eq(models.id, modelId)).get();
    if (!existing) {
      return NextResponse.json({ error: `模型 ${modelId} 不存在` }, { status: 404 });
    }

    await db.update(models).set(body).where(eq(models.id, modelId));
    await invalidateModelsCatalog(await getKV());

    return NextResponse.json({ success: true, model: { ...existing, ...body } });
  } catch (error) {
    console.error('PUT /api/admin/models/[id] 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/models/:id — 删除模型
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const { id: modelId } = await params;
    const db = await getDb();

    const existing = await db.select().from(models).where(eq(models.id, modelId)).get();
    if (!existing) {
      return NextResponse.json({ error: `模型 ${modelId} 不存在` }, { status: 404 });
    }

    await db.delete(models).where(eq(models.id, modelId));
    await invalidateModelsCatalog(await getKV());
    return NextResponse.json({ success: true, modelId });
  } catch (error) {
    console.error('DELETE /api/admin/models/[id] 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
