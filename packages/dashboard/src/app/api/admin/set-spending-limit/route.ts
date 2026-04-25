import { NextResponse } from 'next/server';
import { spendingLimits } from '@/db/app-schema';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/lib/db';

/**
 * POST /api/admin/set-spending-limit — 设置用户月度消费限额
 * Body: { userId: string, monthlyLimit: number, alertThreshold?: number }
 */
export async function POST(request: Request) {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const { userId, monthlyLimit, alertThreshold } = (await request.json()) as {
      userId: string;
      monthlyLimit: number;
      alertThreshold?: number;
    };
    if (!userId || monthlyLimit == null) {
      return NextResponse.json({ error: 'userId 和 monthlyLimit 为必填' }, { status: 400 });
    }

    const db = await getDb();
    await db
      .insert(spendingLimits)
      .values({ userId, monthlyLimit, alertThreshold })
      .onConflictDoUpdate({
        target: spendingLimits.userId,
        set: {
          monthlyLimit,
          alertThreshold,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ success: true, userId, monthlyLimit, alertThreshold });
  } catch (error) {
    console.error('POST /api/admin/set-spending-limit 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
