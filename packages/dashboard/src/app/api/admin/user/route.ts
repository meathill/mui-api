import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getKV, getUserData } from '@/lib/kv';
import { getDb } from '@/lib/db';
import { user as userTable } from '@/db/schema';

/**
 * GET /api/admin/user — 查询单个用户信息
 * Query: email 或 userId
 */
export async function GET(request: NextRequest) {
  const result = await requireAdmin();
  if ('error' in result) return result.error;

  const searchParams = new URL(request.url).searchParams;
  const email = searchParams.get('email');
  const queryUserId = searchParams.get('userId');

  let userId = queryUserId;

  if (!userId && email) {
    const db = await getDb();
    const row = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, email)).get();
    if (!row) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }
    userId = row.id;
  }

  if (!userId) {
    return NextResponse.json({ error: '需要提供 email 或 userId' }, { status: 400 });
  }

  const kv = await getKV();
  const { data, metadata } = await getUserData(kv, userId);

  if (!data || !metadata) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    user: {
      userId,
      email: metadata.email,
      balance: data.balance,
      concurrency: data.concurrency,
      isSuspended: data.isSuspended ?? false,
      maxConcurrency: metadata.maxConcurrency ?? 3,
      createdAt: metadata.createdAt,
    },
  });
}
