import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { connection, type NextRequest, NextResponse } from 'next/server';
import { rechargeLogs } from '@/db/app-schema';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/lib/db';

/**
 * GET /api/admin/recharge-logs — 查询充值记录
 */
export async function GET(request: NextRequest) {
  await connection();

  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const searchParams = new URL(request.url).searchParams;
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '20')));

    const conditions = [];
    if (userId) conditions.push(eq(rechargeLogs.userId, userId));
    if (startDate) {
      const start = new Date(startDate);
      conditions.push(gte(rechargeLogs.createdAt, start));
    }
    if (endDate) {
      const end = new Date(`${endDate}T23:59:59`);
      conditions.push(lte(rechargeLogs.createdAt, end));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const db = await getDb();

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(rechargeLogs).where(where).get();
    const total = countResult?.count ?? 0;

    const offset = (page - 1) * pageSize;
    const logs = await db
      .select()
      .from(rechargeLogs)
      .where(where)
      .orderBy(desc(rechargeLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    return NextResponse.json({
      success: true,
      logs,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error('GET /api/admin/recharge-logs 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
