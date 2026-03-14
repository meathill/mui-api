import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getKV, getGlobalConfig, getSpendingStats } from '@/lib/kv';

/**
 * GET /api/admin/spending-stats — 消费统计
 */
export async function GET() {
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
}
