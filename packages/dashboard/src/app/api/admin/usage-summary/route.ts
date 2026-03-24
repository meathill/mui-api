import { NextResponse } from 'next/server';
import { gte, sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/lib/db';
import { usageLogs } from '@/db/app-schema';

/**
 * GET /api/admin/usage-summary — 今日用量汇总
 */
export async function GET() {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const db = await getDb();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const row = await db
      .select({
        totalCost: sql<number>`coalesce(sum(cost), 0)`,
        totalInput: sql<number>`coalesce(sum(input_tokens), 0)`,
        totalOutput: sql<number>`coalesce(sum(output_tokens), 0)`,
        totalRequests: sql<number>`count(*)`,
      })
      .from(usageLogs)
      .where(gte(usageLogs.createdAt, todayStart))
      .get();

    return NextResponse.json({
      success: true,
      summary: {
        cost: row?.totalCost ?? 0,
        inputTokens: row?.totalInput ?? 0,
        outputTokens: row?.totalOutput ?? 0,
        requests: row?.totalRequests ?? 0,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/usage-summary 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
