import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { spendingLimits } from '@/db/app-schema';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/lib/db';
import { getKV, unsuspendUser } from '@/lib/kv';

/**
 * POST /api/admin/unsuspend-user — 解除用户暂停
 * Body: { userId: string }
 */
export async function POST(request: Request) {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const { userId } = (await request.json()) as { userId: string };
    if (!userId) {
      return NextResponse.json({ error: 'userId 不能为空' }, { status: 400 });
    }

    const kv = await getKV();
    await unsuspendUser(kv, userId);

    const db = await getDb();
    await db
      .update(spendingLimits)
      .set({ isSuspended: false, updatedAt: new Date() })
      .where(eq(spendingLimits.userId, userId));

    return NextResponse.json({ success: true, userId });
  } catch (error) {
    console.error('POST /api/admin/unsuspend-user 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
