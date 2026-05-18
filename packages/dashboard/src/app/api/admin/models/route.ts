import { NextResponse } from 'next/server';
import { models } from '@/db/app-schema';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/lib/db';
import { getKV, invalidateModelsCatalog } from '@/lib/kv';

interface ModelWriteBody {
  id?: string;
  provider?: string;
  upstreamModelId?: string;
  inputPrice?: number;
  outputPrice?: number;
  markupRate?: number;
  cachedInputPrice?: number | null;
  cacheWritePrice?: number | null;
  longContextThresholdTokens?: number | null;
  longContextInputPrice?: number | null;
  longContextCachedInputPrice?: number | null;
  longContextCacheWritePrice?: number | null;
  longContextOutputPrice?: number | null;
}

const OPTIONAL_PRICE_FIELDS = [
  'cachedInputPrice',
  'cacheWritePrice',
  'longContextInputPrice',
  'longContextCachedInputPrice',
  'longContextCacheWritePrice',
  'longContextOutputPrice',
] as const;

export function validateModelBody(body: ModelWriteBody): NextResponse | null {
  if (body.inputPrice != null && body.inputPrice < 0) {
    return NextResponse.json({ error: '输入价格不能为负数' }, { status: 400 });
  }
  if (body.outputPrice != null && body.outputPrice < 0) {
    return NextResponse.json({ error: '输出价格不能为负数' }, { status: 400 });
  }
  if (body.markupRate != null && body.markupRate < 0.01) {
    return NextResponse.json({ error: '加价倍率不能小于 0.01' }, { status: 400 });
  }
  for (const field of OPTIONAL_PRICE_FIELDS) {
    const v = body[field];
    if (v != null && v < 0) {
      return NextResponse.json({ error: `${field} 不能为负数` }, { status: 400 });
    }
  }
  if (body.longContextThresholdTokens != null) {
    if (!Number.isInteger(body.longContextThresholdTokens) || body.longContextThresholdTokens <= 0) {
      return NextResponse.json({ error: '长上下文档位阈值必须为正整数' }, { status: 400 });
    }
  }
  return null;
}

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

    const body = (await request.json()) as ModelWriteBody;
    const { id, provider } = body;

    if (!id || !provider) {
      return NextResponse.json({ error: 'id 和 provider 为必填' }, { status: 400 });
    }

    const validationError = validateModelBody(body);
    if (validationError) return validationError;

    const db = await getDb();
    try {
      await db.insert(models).values({
        id,
        provider,
        upstreamModelId: body.upstreamModelId,
        inputPrice: body.inputPrice,
        outputPrice: body.outputPrice,
        markupRate: body.markupRate,
        cachedInputPrice: body.cachedInputPrice,
        cacheWritePrice: body.cacheWritePrice,
        longContextThresholdTokens: body.longContextThresholdTokens,
        longContextInputPrice: body.longContextInputPrice,
        longContextCachedInputPrice: body.longContextCachedInputPrice,
        longContextCacheWritePrice: body.longContextCacheWritePrice,
        longContextOutputPrice: body.longContextOutputPrice,
      });
      // 失效 KV 缓存，让后端 ModelCatalogService 下次 getAll() 回源 D1
      await invalidateModelsCatalog(await getKV());
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
