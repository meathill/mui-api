import { NextResponse } from 'next/server';
import { models } from '@/db/app-schema';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/lib/db';

/**
 * GET /api/admin/models — 列出所有模型
 */
export async function GET() {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const db = await getDb();
    const modelList = await db.select().from(models);
    return NextResponse.json({ success: true, models: modelList });
  } catch (error) {
    console.error('GET /api/admin/models 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

/**
 * POST /api/admin/models — 创建模型
 */
export async function POST(request: Request) {
  try {
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
    if (inputPrice != null && inputPrice < 0) {
      return NextResponse.json({ error: '输入价格不能为负数' }, { status: 400 });
    }
    if (outputPrice != null && outputPrice < 0) {
      return NextResponse.json({ error: '输出价格不能为负数' }, { status: 400 });
    }
    if (markupRate != null && markupRate < 0.01) {
      return NextResponse.json({ error: '加价倍率不能小于 0.01' }, { status: 400 });
    }

    const db = await getDb();
    try {
      await db.insert(models).values({ id, provider, upstreamModelId, inputPrice, outputPrice, markupRate });
      return NextResponse.json({ success: true, model: body }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        return NextResponse.json({ error: `模型 ${id} 已存在` }, { status: 400 });
      }
      throw error;
    }
  } catch (error) {
    console.error('POST /api/admin/models 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
