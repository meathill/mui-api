import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/lib/db';
import { models } from '@/db/app-schema';

/**
 * PUT /api/admin/models/:id — 更新模型
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAdmin();
  if ('error' in result) return result.error;

  const { id: modelId } = await params;
  const body = (await request.json()) as {
    provider?: string;
    upstreamModelId?: string;
    inputPrice?: number;
    outputPrice?: number;
    markupRate?: number;
  };
  const db = await getDb();

  const existing = await db.select().from(models).where(eq(models.id, modelId)).get();
  if (!existing) {
    return NextResponse.json({ error: `模型 ${modelId} 不存在` }, { status: 404 });
  }

  await db.update(models).set(body).where(eq(models.id, modelId));

  return NextResponse.json({ success: true, model: { ...existing, ...body } });
}

/**
 * DELETE /api/admin/models/:id — 删除模型
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireAdmin();
  if ('error' in result) return result.error;

  const { id: modelId } = await params;
  const db = await getDb();

  const existing = await db.select().from(models).where(eq(models.id, modelId)).get();
  if (!existing) {
    return NextResponse.json({ error: `模型 ${modelId} 不存在` }, { status: 404 });
  }

  await db.delete(models).where(eq(models.id, modelId));
  return NextResponse.json({ success: true, modelId });
}
