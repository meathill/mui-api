import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { usageLogs, usageStats } from '@/db/app-schema';
import { user } from '@/db/schema';
import { requireAdmin } from '@/lib/admin';
import { getDb } from '@/lib/db';

type Granularity = 'hourly' | 'daily' | 'weekly' | 'monthly';

/**
 * 根据时间范围自动选择合适的粒度
 */
function autoGranularity(startDate: Date, endDate: Date): Granularity {
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays <= 2) return 'hourly';
  if (diffDays <= 31) return 'daily';
  if (diffDays <= 90) return 'weekly';
  return 'monthly';
}

/**
 * GET /api/admin/statistics — 统计分析数据
 */
export async function GET(request: NextRequest) {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const searchParams = new URL(request.url).searchParams;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const granularityParam = searchParams.get('granularity') as Granularity | null;
    const userId = searchParams.get('userId');

    if (!startDateStr || !endDateStr) {
      return NextResponse.json({ error: '必须提供 startDate 和 endDate' }, { status: 400 });
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(`${endDateStr}T23:59:59`);
    const granularity = granularityParam || autoGranularity(startDate, endDate);

    const db = await getDb();

    // 尝试从 usage_stats 获取数据
    const statsCount = await db
      .select({ cnt: sql<number>`count(*)` })
      .from(usageStats)
      .where(
        and(
          eq(usageStats.granularity, granularity),
          gte(usageStats.periodStart, startDate),
          lte(usageStats.periodStart, endDate),
          isNull(usageStats.userId),
          isNull(usageStats.modelId),
        ),
      )
      .get();

    const hasAggregatedData = (statsCount?.cnt ?? 0) > 0;

    if (hasAggregatedData) {
      return NextResponse.json({
        success: true,
        ...(await queryFromStats(db, granularity, startDate, endDate, userId)),
        source: 'aggregated',
      });
    }

    // 回退到实时查询
    return NextResponse.json({
      success: true,
      ...(await queryFromLogs(db, startDate, endDate, userId)),
      source: 'realtime',
    });
  } catch (error) {
    console.error('GET /api/admin/statistics 错误:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

async function queryFromStats(
  db: Awaited<ReturnType<typeof getDb>>,
  granularity: Granularity,
  startDate: Date,
  endDate: Date,
  userId: string | null,
) {
  // 概览
  const overviewConditions = [
    eq(usageStats.granularity, granularity),
    gte(usageStats.periodStart, startDate),
    lte(usageStats.periodStart, endDate),
    isNull(usageStats.modelId),
  ];
  if (userId) {
    overviewConditions.push(eq(usageStats.userId, userId));
  } else {
    overviewConditions.push(isNull(usageStats.userId));
  }

  const overviewRow = await db
    .select({
      totalCost: sql<number>`coalesce(sum(${usageStats.totalCost}), 0)`,
      totalInputTokens: sql<number>`coalesce(sum(${usageStats.totalInputTokens}), 0)`,
      totalOutputTokens: sql<number>`coalesce(sum(${usageStats.totalOutputTokens}), 0)`,
      requestCount: sql<number>`coalesce(sum(${usageStats.requestCount}), 0)`,
    })
    .from(usageStats)
    .where(and(...overviewConditions))
    .get();

  // 按模型
  const modelConditions = [
    eq(usageStats.granularity, granularity),
    gte(usageStats.periodStart, startDate),
    lte(usageStats.periodStart, endDate),
    isNull(usageStats.userId),
    sql`${usageStats.modelId} IS NOT NULL`,
  ];
  const byModel = await db
    .select({
      modelId: usageStats.modelId,
      totalCost: sql<number>`coalesce(sum(${usageStats.totalCost}), 0)`,
      totalInputTokens: sql<number>`coalesce(sum(${usageStats.totalInputTokens}), 0)`,
      totalOutputTokens: sql<number>`coalesce(sum(${usageStats.totalOutputTokens}), 0)`,
      requestCount: sql<number>`coalesce(sum(${usageStats.requestCount}), 0)`,
    })
    .from(usageStats)
    .where(and(...modelConditions))
    .groupBy(usageStats.modelId)
    .orderBy(desc(sql`sum(${usageStats.totalCost})`));

  // 按用户
  let byUser: Array<{ userId: string | null; email: string | null; totalCost: number; requestCount: number }> = [];
  if (!userId) {
    const userConditions = [
      eq(usageStats.granularity, granularity),
      gte(usageStats.periodStart, startDate),
      lte(usageStats.periodStart, endDate),
      sql`${usageStats.userId} IS NOT NULL`,
      isNull(usageStats.modelId),
    ];
    byUser = await db
      .select({
        userId: usageStats.userId,
        email: user.email,
        totalCost: sql<number>`coalesce(sum(${usageStats.totalCost}), 0)`,
        requestCount: sql<number>`coalesce(sum(${usageStats.requestCount}), 0)`,
      })
      .from(usageStats)
      .leftJoin(user, eq(usageStats.userId, user.id))
      .where(and(...userConditions))
      .groupBy(usageStats.userId)
      .orderBy(desc(sql`sum(${usageStats.totalCost})`))
      .limit(20);
  }

  // 时间序列
  const tsConditions = [...overviewConditions];
  const timeSeries = await db
    .select({
      periodStart: usageStats.periodStart,
      totalCost: usageStats.totalCost,
      requestCount: usageStats.requestCount,
    })
    .from(usageStats)
    .where(and(...tsConditions))
    .orderBy(usageStats.periodStart);

  return {
    overview: {
      totalCost: overviewRow?.totalCost ?? 0,
      totalInputTokens: overviewRow?.totalInputTokens ?? 0,
      totalOutputTokens: overviewRow?.totalOutputTokens ?? 0,
      requestCount: overviewRow?.requestCount ?? 0,
    },
    byModel,
    byUser,
    timeSeries,
  };
}

async function queryFromLogs(
  db: Awaited<ReturnType<typeof getDb>>,
  startDate: Date,
  endDate: Date,
  userId: string | null,
) {
  const baseConditions = [gte(usageLogs.createdAt, startDate), lte(usageLogs.createdAt, endDate)];
  if (userId) baseConditions.push(eq(usageLogs.userId, userId));

  // 概览
  const overviewRow = await db
    .select({
      totalCost: sql<number>`coalesce(sum(${usageLogs.cost}), 0)`,
      totalInputTokens: sql<number>`coalesce(sum(${usageLogs.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`coalesce(sum(${usageLogs.outputTokens}), 0)`,
      requestCount: sql<number>`count(*)`,
    })
    .from(usageLogs)
    .where(and(...baseConditions))
    .get();

  // 按模型
  const byModel = await db
    .select({
      modelId: usageLogs.modelId,
      totalCost: sql<number>`coalesce(sum(${usageLogs.cost}), 0)`,
      totalInputTokens: sql<number>`coalesce(sum(${usageLogs.inputTokens}), 0)`,
      totalOutputTokens: sql<number>`coalesce(sum(${usageLogs.outputTokens}), 0)`,
      requestCount: sql<number>`count(*)`,
    })
    .from(usageLogs)
    .where(and(...baseConditions))
    .groupBy(usageLogs.modelId)
    .orderBy(desc(sql`sum(${usageLogs.cost})`));

  // 按用户
  let byUser: Array<{ userId: string | null; email: string | null; totalCost: number; requestCount: number }> = [];
  if (!userId) {
    byUser = await db
      .select({
        userId: usageLogs.userId,
        email: user.email,
        totalCost: sql<number>`coalesce(sum(${usageLogs.cost}), 0)`,
        requestCount: sql<number>`count(*)`,
      })
      .from(usageLogs)
      .leftJoin(user, eq(usageLogs.userId, user.id))
      .where(and(...baseConditions))
      .groupBy(usageLogs.userId)
      .orderBy(desc(sql`sum(${usageLogs.cost})`))
      .limit(20);
  }

  // 时间序列：按天聚合
  const timeSeries = await db
    .select({
      periodStart: sql<string>`date(${usageLogs.createdAt}, 'unixepoch')`,
      totalCost: sql<number>`coalesce(sum(${usageLogs.cost}), 0)`,
      requestCount: sql<number>`count(*)`,
    })
    .from(usageLogs)
    .where(and(...baseConditions))
    .groupBy(sql`date(${usageLogs.createdAt}, 'unixepoch')`)
    .orderBy(sql`date(${usageLogs.createdAt}, 'unixepoch')`);

  return {
    overview: {
      totalCost: overviewRow?.totalCost ?? 0,
      totalInputTokens: overviewRow?.totalInputTokens ?? 0,
      totalOutputTokens: overviewRow?.totalOutputTokens ?? 0,
      requestCount: overviewRow?.requestCount ?? 0,
    },
    byModel,
    byUser,
    timeSeries,
  };
}
