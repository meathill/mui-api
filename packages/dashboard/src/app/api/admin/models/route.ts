import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/lib/db';
import { models } from '@/db/app-schema';

/**
 * GET /api/admin/models — 列出所有模型
 */
export async function GET() {
  const result = await requireAdmin();
  if ('error' in result) return result.error;

  const db = await getDb();
  const modelList = await db.select().from(models);
  return NextResponse.json({ success: true, models: modelList });
}

/**
 * POST /api/admin/models — 创建模型
 */
export async function POST(request: Request) {
  const result = await requireAdmin();
  if ('error' in result) return result.error;

  const body = (await request.json()) as Record<string, unknown>;
  const { id, provider, upstreamModelId, inputPrice, outputPrice, markupRate } = body as {
    id: string;
    provider: string;
    upstreamModelId?: string;
    inputPrice?: number;
    outputPrice?: number;
    markupRate?: number;
  };

  if (!id || !provider) {
    return NextResponse.json({ error: 'id 和 provider 为必填' }, { status: 400 });
  }

  const db = await getDb();
  try {
    await db.insert(models).values({ id, provider, upstreamModelId, inputPrice, outputPrice, markupRate });
    return NextResponse.json({ success: true, model: body }, { status: 201 });
  } catch (error) {
    if (String(error).includes('UNIQUE')) {
      return NextResponse.json({ error: `模型 ${id} 已存在` }, { status: 400 });
    }
    throw error;
  }
}
