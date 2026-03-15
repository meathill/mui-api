import { NextRequest, NextResponse } from 'next/server';
import { sql, desc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/lib/db';
import { getKV, getUserData } from '@/lib/kv';
import { user as userTable } from '@/db/schema';

/**
 * GET /api/admin/users — 列出所有用户
 * 以 D1 user 表为主，KV 补充余额等运行时数据
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const searchParams = new URL(request.url).searchParams;
    const page = Number(searchParams.get('page') || '1');
    const pageSize = Number(searchParams.get('pageSize') || '50');
    const offset = (page - 1) * pageSize;

    const db = await getDb();

    // 从 D1 user 表分页查询所有已注册用户
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(userTable).get();
    const total = countResult?.count ?? 0;

    const dbUsers = await db
      .select({
        id: userTable.id,
        email: userTable.email,
        name: userTable.name,
        createdAt: userTable.createdAt,
      })
      .from(userTable)
      .orderBy(desc(userTable.createdAt))
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
