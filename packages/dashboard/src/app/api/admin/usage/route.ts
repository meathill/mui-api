import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { usageLogs } from '@/db/app-schema';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/lib/db';

/**
 * GET /api/admin/usage — 查询用量日志
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const searchParams = new URL(request.url).searchParams;
    const userId = searchParams.get('userId');
    const modelId = searchParams.get('modelId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = Number(searchParams.get('page') || '1');
    const pageSize = Number(searchParams.get('pageSize') || '20');

    const conditions = [];
    if (userId) conditions.push(eq(usageLogs.userId, userId));
    if (modelId) conditions.push(eq(usageLogs.modelId, modelId));
    if (startDate) conditions.push(gte(usageLogs.createdAt, new Date(startDate)));
    if (endDate) conditions.push(lte(usageLogs.createdAt, new Date(endDate)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const db = await getDb();

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(usageLogs).where(where).get();
    const total = countResult?.count ?? 0;

    const offset = (page - 1) * pageSize;
    const logs = await db
      .select()
      .from(usageLogs)
      .where(where)
      .orderBy(desc(usageLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    return NextResponse.json({
      success: true,
      logs,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error('GET /api/admin/usage 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
