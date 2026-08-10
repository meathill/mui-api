import { eq } from 'drizzle-orm';
import { connection, type NextRequest, NextResponse } from 'next/server';
import { user as userTable } from '@/db/schema';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/lib/db';
import { getKV, getUserData } from '@/lib/kv';

/**
 * GET /api/admin/user — 查询单个用户信息
 * Query: email 或 userId
 *
 * 与 /api/admin/users 列表保持同一口径：以 D1 user 表判断用户是否存在，
 * KV 只补充余额等运行时数据——注册后从未充值的用户 KV 中没有记录，
 * 此时返回默认值而不是 404，避免"列表可见、详情不存在"的矛盾。
 */
export async function GET(request: NextRequest) {
  await connection();

  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const searchParams = new URL(request.url).searchParams;
    const email = searchParams.get('email');
    const queryUserId = searchParams.get('userId');

    if (!queryUserId && !email) {
      return NextResponse.json({ error: '需要提供 email 或 userId' }, { status: 400 });
    }

    const db = await getDb();
    const row = await db
      .select({ id: userTable.id, email: userTable.email, createdAt: userTable.createdAt })
      .from(userTable)
      .where(queryUserId ? eq(userTable.id, queryUserId) : eq(userTable.email, email as string))
      .get();

    const userId = row?.id ?? queryUserId;
    if (!userId) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const kv = await getKV();
    const { data, metadata } = await getUserData(kv, userId);

    // 按 userId 查询时保留 KV 兜底：仅存在于 KV 的历史用户不在 D1 user 表里
    if (!row && (!data || !metadata)) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        userId,
        email: metadata?.email ?? row?.email,
        balance: data?.balance ?? 0,
        concurrency: data?.concurrency ?? 0,
        isSuspended: data?.isSuspended ?? false,
        maxConcurrency: metadata?.maxConcurrency ?? 3,
        rateMultiplier: metadata?.rateMultiplier ?? 1,
        createdAt: metadata?.createdAt ?? row?.createdAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/user 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
