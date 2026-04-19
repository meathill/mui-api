import { and, count, eq, gte, isNull, lt, sql, sum } from 'drizzle-orm';
import type { Database } from '../db';
import { usageLogs, usageStats } from '../db/schema';
import { generateId } from '../lib/crypto';
import type { PeriodRange } from './stats-aggregation-periods';

export type Granularity = 'hourly' | 'daily' | 'weekly' | 'monthly';

interface AggregateRow {
  dimension: string | null;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  requestCount: number;
}

interface AggregateData {
  global: AggregateRow;
  byUser: Array<{ userId: string } & AggregateRow>;
  byModel: Array<{ modelId: string } & AggregateRow>;
}

type UpsertRow = { userId: string | null; modelId: string | null } & AggregateRow;

async function upsertStats(
  db: Database,
  granularity: Granularity,
  period: PeriodRange,
  rows: UpsertRow[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const now = new Date();

  for (const row of rows) {
    const existing = await db
      .select({ id: usageStats.id })
      .from(usageStats)
      .where(
        and(
          eq(usageStats.granularity, granularity),
          eq(usageStats.periodStart, period.start),
          row.userId ? eq(usageStats.userId, row.userId) : isNull(usageStats.userId),
          row.modelId ? eq(usageStats.modelId, row.modelId) : isNull(usageStats.modelId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(usageStats)
        .set({
          requestCount: row.requestCount,
          totalCost: row.totalCost,
          totalInputTokens: row.totalInputTokens,
          totalOutputTokens: row.totalOutputTokens,
          updatedAt: now,
        })
        .where(eq(usageStats.id, existing[0].id));
      continue;
    }

    await db.insert(usageStats).values({
      id: generateId(),
      granularity,
      modelId: row.modelId,
      periodEnd: period.end,
      periodStart: period.start,
      requestCount: row.requestCount,
      totalCost: row.totalCost,
      totalInputTokens: row.totalInputTokens,
      totalOutputTokens: row.totalOutputTokens,
      userId: row.userId,
    });
  }
}

async function aggregateFromLogs(db: Database, period: PeriodRange): Promise<AggregateData> {
  const [globalResult] = await db
    .select({
      requestCount: count(),
      totalCost: sum(usageLogs.cost).mapWith(Number),
      totalInputTokens: sum(usageLogs.inputTokens).mapWith(Number),
      totalOutputTokens: sum(usageLogs.outputTokens).mapWith(Number),
    })
    .from(usageLogs)
    .where(and(gte(usageLogs.createdAt, period.start), lt(usageLogs.createdAt, period.end)));

  const byUserResults = await db
    .select({
      requestCount: count(),
      totalCost: sum(usageLogs.cost).mapWith(Number),
      totalInputTokens: sum(usageLogs.inputTokens).mapWith(Number),
      totalOutputTokens: sum(usageLogs.outputTokens).mapWith(Number),
      userId: usageLogs.userId,
    })
    .from(usageLogs)
    .where(and(gte(usageLogs.createdAt, period.start), lt(usageLogs.createdAt, period.end)))
    .groupBy(usageLogs.userId);

  const byModelResults = await db
    .select({
      modelId: usageLogs.modelId,
      requestCount: count(),
      totalCost: sum(usageLogs.cost).mapWith(Number),
      totalInputTokens: sum(usageLogs.inputTokens).mapWith(Number),
      totalOutputTokens: sum(usageLogs.outputTokens).mapWith(Number),
    })
    .from(usageLogs)
    .where(and(gte(usageLogs.createdAt, period.start), lt(usageLogs.createdAt, period.end)))
    .groupBy(usageLogs.modelId);

  return {
    global: {
      dimension: null,
      requestCount: globalResult.requestCount || 0,
      totalCost: globalResult.totalCost || 0,
      totalInputTokens: globalResult.totalInputTokens || 0,
      totalOutputTokens: globalResult.totalOutputTokens || 0,
    },
    byUser: byUserResults
      .filter((row) => row.userId)
      .map((row) => ({
        userId: row.userId!,
        dimension: row.userId,
        requestCount: row.requestCount || 0,
        totalCost: row.totalCost || 0,
        totalInputTokens: row.totalInputTokens || 0,
        totalOutputTokens: row.totalOutputTokens || 0,
      })),
    byModel: byModelResults
      .filter((row) => row.modelId)
      .map((row) => ({
        modelId: row.modelId!,
        dimension: row.modelId,
        requestCount: row.requestCount || 0,
        totalCost: row.totalCost || 0,
        totalInputTokens: row.totalInputTokens || 0,
        totalOutputTokens: row.totalOutputTokens || 0,
      })),
  };
}

async function aggregateFromStats(
  db: Database,
  sourceGranularity: Granularity,
  period: PeriodRange,
): Promise<AggregateData | null> {
  const [checkResult] = await db
    .select({ cnt: count() })
    .from(usageStats)
    .where(
      and(
        eq(usageStats.granularity, sourceGranularity),
        gte(usageStats.periodStart, period.start),
        lt(usageStats.periodStart, period.end),
        isNull(usageStats.userId),
        isNull(usageStats.modelId),
      ),
    );

  if (!checkResult?.cnt) {
    return null;
  }

  const [globalResult] = await db
    .select({
      requestCount: sum(usageStats.requestCount).mapWith(Number),
      totalCost: sum(usageStats.totalCost).mapWith(Number),
      totalInputTokens: sum(usageStats.totalInputTokens).mapWith(Number),
      totalOutputTokens: sum(usageStats.totalOutputTokens).mapWith(Number),
    })
    .from(usageStats)
    .where(
      and(
        eq(usageStats.granularity, sourceGranularity),
        gte(usageStats.periodStart, period.start),
        lt(usageStats.periodStart, period.end),
        isNull(usageStats.userId),
        isNull(usageStats.modelId),
      ),
    );

  const byUserResults = await db
    .select({
      requestCount: sum(usageStats.requestCount).mapWith(Number),
      totalCost: sum(usageStats.totalCost).mapWith(Number),
      totalInputTokens: sum(usageStats.totalInputTokens).mapWith(Number),
      totalOutputTokens: sum(usageStats.totalOutputTokens).mapWith(Number),
      userId: usageStats.userId,
    })
    .from(usageStats)
    .where(
      and(
        eq(usageStats.granularity, sourceGranularity),
        gte(usageStats.periodStart, period.start),
        lt(usageStats.periodStart, period.end),
        sql`${usageStats.userId} IS NOT NULL`,
        isNull(usageStats.modelId),
      ),
    )
    .groupBy(usageStats.userId);

  const byModelResults = await db
    .select({
      modelId: usageStats.modelId,
      requestCount: sum(usageStats.requestCount).mapWith(Number),
      totalCost: sum(usageStats.totalCost).mapWith(Number),
      totalInputTokens: sum(usageStats.totalInputTokens).mapWith(Number),
      totalOutputTokens: sum(usageStats.totalOutputTokens).mapWith(Number),
    })
    .from(usageStats)
    .where(
      and(
        eq(usageStats.granularity, sourceGranularity),
        gte(usageStats.periodStart, period.start),
        lt(usageStats.periodStart, period.end),
        isNull(usageStats.userId),
        sql`${usageStats.modelId} IS NOT NULL`,
      ),
    )
    .groupBy(usageStats.modelId);

  return {
    global: {
      dimension: null,
      requestCount: globalResult.requestCount || 0,
      totalCost: globalResult.totalCost || 0,
      totalInputTokens: globalResult.totalInputTokens || 0,
      totalOutputTokens: globalResult.totalOutputTokens || 0,
    },
    byUser: byUserResults
      .filter((row) => row.userId)
      .map((row) => ({
        userId: row.userId!,
        dimension: row.userId,
        requestCount: row.requestCount || 0,
        totalCost: row.totalCost || 0,
        totalInputTokens: row.totalInputTokens || 0,
        totalOutputTokens: row.totalOutputTokens || 0,
      })),
    byModel: byModelResults
      .filter((row) => row.modelId)
      .map((row) => ({
        modelId: row.modelId!,
        dimension: row.modelId,
        requestCount: row.requestCount || 0,
        totalCost: row.totalCost || 0,
        totalInputTokens: row.totalInputTokens || 0,
        totalOutputTokens: row.totalOutputTokens || 0,
      })),
  };
}

function toUpsertRows(data: AggregateData): UpsertRow[] {
  const rows: UpsertRow[] = [{ userId: null, modelId: null, ...data.global }];

  for (const { userId, ...rest } of data.byUser) {
    rows.push({ userId, modelId: null, ...rest });
  }

  for (const { modelId, ...rest } of data.byModel) {
    rows.push({ userId: null, modelId, ...rest });
  }

  return rows;
}

export async function aggregateStatsForPeriod(params: {
  db: Database;
  granularity: Granularity;
  label: string;
  period: PeriodRange;
  sourceGranularity?: Granularity;
}): Promise<void> {
  console.log(`[cron] ${params.label}: ${params.period.start.toISOString()} ~ ${params.period.end.toISOString()}`);

  let data = params.sourceGranularity
    ? await aggregateFromStats(params.db, params.sourceGranularity, params.period)
    : await aggregateFromLogs(params.db, params.period);

  if (!data && params.sourceGranularity) {
    console.log(`[cron] ${params.label}: 无${params.sourceGranularity}数据，回退到 usage_logs`);
    data = await aggregateFromLogs(params.db, params.period);
  }

  if (!data || data.global.requestCount === 0) {
    console.log(`[cron] ${params.label}: 无数据，跳过`);
    return;
  }

  const rows = toUpsertRows(data);
  await upsertStats(params.db, params.granularity, params.period, rows);
  console.log(`[cron] ${params.label}完成: ${rows.length} 行`);
}
