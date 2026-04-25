import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { models } from '@/db/app-schema';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/lib/db';

/**
 * PUT /api/admin/models/:id — 更新模型
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
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

    if (body.inputPrice != null && body.inputPrice < 0) {
      return NextResponse.json({ error: '输入价格不能为负数' }, { status: 400 });
    }
    if (body.outputPrice != null && body.outputPrice < 0) {
      return NextResponse.json({ error: '输出价格不能为负数' }, { status: 400 });
    }
    if (body.markupRate != null && body.markupRate < 0.01) {
      return NextResponse.json({ error: '加价倍率不能小于 0.01' }, { status: 400 });
    }

    const existing = await db.select().from(models).where(eq(models.id, modelId)).get();
    if (!existing) {
      return NextResponse.json({ error: `模型 ${modelId} 不存在` }, { status: 404 });
    }

    await db.update(models).set(body).where(eq(models.id, modelId));

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
    return NextResponse.json({ success: true, modelId });
  } catch (error) {
    console.error('DELETE /api/admin/models/[id] 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
