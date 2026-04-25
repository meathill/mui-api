import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { usageLogs } from '@/db/app-schema';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';

/**
 * GET /api/user/usage — 获取当前用户的用量记录
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await getSession();
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const db = await getDb();

    const searchParams = new URL(request.url).searchParams;
    const modelId = searchParams.get('modelId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = Number(searchParams.get('page') || '1');
    const pageSize = Number(searchParams.get('pageSize') || '20');

    const conditions = [eq(usageLogs.userId, user.id)];
    if (modelId) conditions.push(eq(usageLogs.modelId, modelId));
    if (startDate) conditions.push(gte(usageLogs.createdAt, new Date(startDate)));
    if (endDate) conditions.push(lte(usageLogs.createdAt, new Date(endDate)));

    const where = and(...conditions);

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
      logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('GET /api/user/usage 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
