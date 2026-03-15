import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getKV, getUserData } from '@/lib/kv';

/**
 * GET /api/user — 获取当前登录用户的信息（余额、并发等）
 */
export async function GET() {
  try {
    const { user } = await getSession();
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const kv = await getKV();
    const { data, metadata } = await getUserData(kv, user.id);

    return NextResponse.json({
      user: {
        userId: user.id,
        email: user.email,
        balance: data?.balance ?? 0,
        concurrency: data?.concurrency ?? 0,
        isSuspended: data?.isSuspended ?? false,
        maxConcurrency: metadata?.maxConcurrency ?? 3,
        createdAt: metadata?.createdAt ?? null,
      },
    });
  } catch (error) {
    console.error('GET /api/user 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
