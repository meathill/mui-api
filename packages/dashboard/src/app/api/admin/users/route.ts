import { asc, desc, like, sql } from 'drizzle-orm';
import { connection, type NextRequest, NextResponse } from 'next/server';
import { user as userTable } from '@/db/schema';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/lib/db';
import { getKV, getUserData } from '@/lib/kv';

/**
 * GET /api/admin/users — 列出所有用户
 * 以 D1 user 表为主，KV 补充余额等运行时数据
 */
export async function GET(request: NextRequest) {
  await connection();

  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const searchParams = new URL(request.url).searchParams;
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '20')));
    const q = searchParams.get('q')?.trim() || searchParams.get('search')?.trim() || '';
    const rawSortBy = searchParams.get('sortBy') || searchParams.get('sortField') || '';
    const rawSortDir = searchParams.get('sortDir') || searchParams.get('sortDirection') || '';
    const SORTABLE = { email: userTable.email, createdAt: userTable.createdAt } as const;
    const sortBy: keyof typeof SORTABLE = rawSortBy in SORTABLE ? (rawSortBy as keyof typeof SORTABLE) : 'createdAt';
    const sortDir = rawSortDir === 'asc' ? 'asc' : 'desc';
    const orderExpr = sortDir === 'asc' ? asc(SORTABLE[sortBy]) : desc(SORTABLE[sortBy]);
    // 兼容旧 cursor 参数（已废弃）
    const offset = (page - 1) * pageSize;

    const db = await getDb();

    // 邮箱服务端筛选（大小写不敏感）
    const whereClause = q ? like(sql`lower(${userTable.email})`, `%${q.toLowerCase()}%`) : undefined;

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(userTable).where(whereClause).get();
    const total = countResult?.count ?? 0;

    const dbUsers = await db
      .select({
        id: userTable.id,
        email: userTable.email,
        name: userTable.name,
        createdAt: userTable.createdAt,
      })
      .from(userTable)
      .where(whereClause)
      .orderBy(orderExpr)
      .limit(pageSize)
      .offset(offset);

    // 并行从 KV 获取每个用户的运行时数据（余额、并发、暂停状态等）
    const kv = await getKV();
    const users = await Promise.all(
      dbUsers.map(async (dbUser) => {
        const { data, metadata } = await getUserData(kv, dbUser.id);
        return {
          userId: dbUser.id,
          email: dbUser.email,
          balance: data?.balance ?? 0,
          concurrency: data?.concurrency ?? 0,
          isSuspended: data?.isSuspended ?? false,
          maxConcurrency: metadata?.maxConcurrency ?? 3,
          rateMultiplier: metadata?.rateMultiplier ?? 1,
          createdAt: dbUser.createdAt?.toISOString() ?? null,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      users,
      cursor: null, // 向后兼容前端 cursor 字段
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error('GET /api/admin/users 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
