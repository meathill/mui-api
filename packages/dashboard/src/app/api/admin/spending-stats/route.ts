import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getGlobalConfig, getKV, getSpendingStats } from '@/lib/kv';

/**
 * GET /api/admin/spending-stats — 消费统计
 */
export async function GET() {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const kv = await getKV();
    const [stats, globalConfig] = await Promise.all([getSpendingStats(kv), getGlobalConfig(kv)]);

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        dailySpendingCap: globalConfig?.dailySpendingCap ?? 0,
        monthlySpendingCap: globalConfig?.monthlySpendingCap ?? 0,
        isServicePaused: globalConfig?.isServicePaused ?? false,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/spending-stats 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
