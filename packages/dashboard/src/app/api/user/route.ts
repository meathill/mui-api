import { connection, NextResponse } from 'next/server';
import { getFreeQuotaStatus, getGlobalConfig, getKV, getUserData } from '@/lib/kv';
import { getSession } from '@/lib/session';

/**
 * GET /api/user — 获取当前登录用户的信息（余额、并发等）
 */
export async function GET() {
  await connection();

  try {
    const { user } = await getSession();
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const kv = await getKV();
    const [{ data, metadata }, globalConfig] = await Promise.all([getUserData(kv, user.id), getGlobalConfig(kv)]);

    return NextResponse.json({
      user: {
        userId: user.id,
        email: user.email,
        balance: data?.balance ?? 0,
        concurrency: data?.concurrency ?? 0,
        freeQuota: getFreeQuotaStatus(globalConfig, data),
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
