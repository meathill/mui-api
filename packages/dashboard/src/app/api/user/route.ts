import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDb } from '@/lib/db';
import { getKV, resolveAppUserId, getUserData } from '@/lib/kv';

/**
 * GET /api/user — 获取当前登录用户的信息（余额、并发等）
 */
export async function GET() {
  const { user } = await getSession();
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const db = await getDb();
  const appUserId = await resolveAppUserId(db, user.email);

  if (!appUserId) {
    return NextResponse.json({
      user: {
        userId: null,
        email: user.email,
        balance: 0,
        concurrency: 0,
        isSuspended: false,
        maxConcurrency: 3,
        createdAt: null,
      },
    });
  }

  const kv = await getKV();
  const { data, metadata } = await getUserData(kv, appUserId);

  return NextResponse.json({
    user: {
      userId: appUserId,
      email: user.email,
      balance: data?.balance ?? 0,
      concurrency: data?.concurrency ?? 0,
      isSuspended: data?.isSuspended ?? false,
      maxConcurrency: metadata?.maxConcurrency ?? 3,
      createdAt: metadata?.createdAt ?? null,
    },
  });
}
