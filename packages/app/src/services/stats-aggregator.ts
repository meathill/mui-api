import { and, eq, gte, lt, sql, sum, count, isNull } from 'drizzle-orm';
import type { Database } from '../db';
import { usageLogs, usageStats } from '../db/schema';
import { generateId } from '../lib/crypto';

type Granularity = 'hourly' | 'daily' | 'weekly' | 'monthly';

interface AggregateRow {
  dimension: string | null;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  requestCount: number;
}

/**
 * 将聚合结果写入 usage_stats 表
 * 使用 INSERT OR REPLACE（基于唯一索引）保证幂等
 */
async function upsertStats(
  db: Database,
  granularity: Granularity,
  periodStart: Date,
  periodEnd: Date,
  rows: Array<{ userId: string | null; modelId: string | null } & AggregateRow>,
): Promise<void> {
  if (rows.length === 0) return;

  const startTs = Math.floor(periodStart.getTime() / 1000);
  const endTs = Math.floor(periodEnd.getTime() / 1000);
  const nowTs = Math.floor(Date.now() / 1000);

  for (const row of rows) {
    // 先查是否已存在
    const existing = await db
      .select({ id: usageStats.id })
      .from(usageStats)
      .where(
        and(
          eq(usageStats.granularity, granularity),
          eq(usageStats.periodStart, periodStart),
          row.userId ? eq(usageStats.userId, row.userId) : isNull(usageStats.userId),
          row.modelId ? eq(usageStats.modelId, row.modelId) : isNull(usageStats.modelId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // 更新
      await db
        .update(usageStats)
        .set({
          totalCost: row.totalCost,
          totalInputTokens: row.totalInputTokens,
          totalOutputTokens: row.totalOutputTokens,
          requestCount: row.requestCount,
          updatedAt: new Date(nowTs * 1000),
        })
        .where(eq(usageStats.id, existing[0].id));
    } else {
      // 插入
      await db.insert(usageStats).values({
        id: generateId(),
        granularity,
        periodStart,
        periodEnd,
        userId: row.userId,
        modelId: row.modelId,
        totalCost: row.totalCost,
        totalInputTokens: row.totalInputTokens,
        totalOutputTokens: row.totalOutputTokens,
        requestCount: row.requestCount,
      });
    }
  }
}

/**
 * 从 usage_logs 聚合原始数据
 */
async function aggregateFromLogs(
  db: Database,
  periodStart: Date,
  periodEnd: Date,
): Promise<{
  global: AggregateRow;
  byUser: Array<{ userId: string } & AggregateRow>;
  byModel: Array<{ modelId: string } & AggregateRow>;
}> {
  const startTs = periodStart;
  const endTs = periodEnd;

  // 全局聚合
  const [globalResult] = await db
    .select({
      totalCost: sum(usageLogs.cost).mapWith(Number),
      totalInputTokens: sum(usageLogs.inputTokens).mapWith(Number),
      totalOutputTokens: sum(usageLogs.outputTokens).mapWith(Number),
      requestCount: count(),
    })
    .from(usageLogs)
    .where(and(gte(usageLogs.createdAt, startTs), lt(usageLogs.createdAt, endTs)));

  // 按用户聚合
  const byUserResults = await db
    .select({
      userId: usageLogs.userId,
      totalCost: sum(usageLogs.cost).mapWith(Number),
      totalInputTokens: sum(usageLogs.inputTokens).mapWith(Number),
      totalOutputTokens: sum(usageLogs.outputTokens).mapWith(Number),
      requestCount: count(),
    })
    .from(usageLogs)
    .where(and(gte(usageLogs.createdAt, startTs), lt(usageLogs.createdAt, endTs)))
    .groupBy(usageLogs.userId);

  // 按模型聚合
  const byModelResults = await db
    .select({
      modelId: usageLogs.modelId,
      totalCost: sum(usageLogs.cost).mapWith(Number),
      totalInputTokens: sum(usageLogs.inputTokens).mapWith(Number),
      totalOutputTokens: sum(usageLogs.outputTokens).mapWith(Number),
      requestCount: count(),
    })
    .from(usageLogs)
    .where(and(gte(usageLogs.createdAt, startTs), lt(usageLogs.createdAt, endTs)))
    .groupBy(usageLogs.modelId);

  return {
    global: {
      dimension: null,
      totalCost: globalResult.totalCost || 0,
      totalInputTokens: globalResult.totalInputTokens || 0,
      totalOutputTokens: globalResult.totalOutputTokens || 0,
      requestCount: globalResult.requestCount || 0,
    },
    byUser: byUserResults
      .filter((r) => r.userId)
      .map((r) => ({
        userId: r.userId!,
        dimension: r.userId,
        totalCost: r.totalCost || 0,
        totalInputTokens: r.totalInputTokens || 0,
        totalOutputTokens: r.totalOutputTokens || 0,
        requestCount: r.requestCount || 0,
      })),
    byModel: byModelResults
      .filter((r) => r.modelId)
      .map((r) => ({
        modelId: r.modelId!,
        dimension: r.modelId,
        totalCost: r.totalCost || 0,
        totalInputTokens: r.totalInputTokens || 0,
        totalOutputTokens: r.totalOutputTokens || 0,
        requestCount: r.requestCount || 0,
      })),
  };
}

/**
 * 从已有的 usage_stats 聚合更高粒度的数据
 */
async function aggregateFromStats(
  db: Database,
  sourceGranularity: Granularity,
  periodStart: Date,
  periodEnd: Date,
): Promise<{
  global: AggregateRow;
  byUser: Array<{ userId: string } & AggregateRow>;
  byModel: Array<{ modelId: string } & AggregateRow>;
} | null> {
  // 检查是否有源数据
  const checkResult = await db
    .select({ cnt: count() })
    .from(usageStats)
    .where(
      and(
        eq(usageStats.granularity, sourceGranularity),
        gte(usageStats.periodStart, periodStart),
        lt(usageStats.periodStart, periodEnd),
        isNull(usageStats.userId),
        isNull(usageStats.modelId),
      ),
    );

  if (!checkResult[0]?.cnt) return null;

  // 全局聚合
  const [globalResult] = await db
    .select({
      totalCost: sum(usageStats.totalCost).mapWith(Number),
      totalInputTokens: sum(usageStats.totalInputTokens).mapWith(Number),
      totalOutputTokens: sum(usageStats.totalOutputTokens).mapWith(Number),
      requestCount: sum(usageStats.requestCount).mapWith(Number),
    })
    .from(usageStats)
    .where(
      and(
        eq(usageStats.granularity, sourceGranularity),
        gte(usageStats.periodStart, periodStart),
        lt(usageStats.periodStart, periodEnd),
        isNull(usageStats.userId),
        isNull(usageStats.modelId),
      ),
    );

  // 按用户聚合
  const byUserResults = await db
    .select({
      userId: usageStats.userId,
      totalCost: sum(usageStats.totalCost).mapWith(Number),
      totalInputTokens: sum(usageStats.totalInputTokens).mapWith(Number),
      totalOutputTokens: sum(usageStats.totalOutputTokens).mapWith(Number),
      requestCount: sum(usageStats.requestCount).mapWith(Number),
    })
    .from(usageStats)
    .where(
      and(
        eq(usageStats.granularity, sourceGranularity),
        gte(usageStats.periodStart, periodStart),
        lt(usageStats.periodStart, periodEnd),
        sql`${usageStats.userId} IS NOT NULL`,
        isNull(usageStats.modelId),
      ),
    )
    .groupBy(usageStats.userId);

  // 按模型聚合
  const byModelResults = await db
    .select({
      modelId: usageStats.modelId,
      totalCost: sum(usageStats.totalCost).mapWith(Number),
      totalInputTokens: sum(usageStats.totalInputTokens).mapWith(Number),
      totalOutputTokens: sum(usageStats.totalOutputTokens).mapWith(Number),
      requestCount: sum(usageStats.requestCount).mapWith(Number),
    })
    .from(usageStats)
    .where(
      and(
        eq(usageStats.granularity, sourceGranularity),
        gte(usageStats.periodStart, periodStart),
        lt(usageStats.periodStart, periodEnd),
        isNull(usageStats.userId),
        sql`${usageStats.modelId} IS NOT NULL`,
      ),
    )
    .groupBy(usageStats.modelId);

  return {
    global: {
      dimension: null,
      totalCost: globalResult.totalCost || 0,
      totalInputTokens: globalResult.totalInputTokens || 0,
      totalOutputTokens: globalResult.totalOutputTokens || 0,
      requestCount: globalResult.requestCount || 0,
    },
    byUser: byUserResults
      .filter((r) => r.userId)
      .map((r) => ({
        userId: r.userId!,
        dimension: r.userId,
        totalCost: r.totalCost || 0,
        totalInputTokens: r.totalInputTokens || 0,
        totalOutputTokens: r.totalOutputTokens || 0,
        requestCount: r.requestCount || 0,
      })),
    byModel: byModelResults
      .filter((r) => r.modelId)
      .map((r) => ({
        modelId: r.modelId!,
        dimension: r.modelId,
        totalCost: r.totalCost || 0,
        totalInputTokens: r.totalInputTokens || 0,
        totalOutputTokens: r.totalOutputTokens || 0,
        requestCount: r.requestCount || 0,
      })),
  };
}

/**
 * 将聚合结果转为 upsert 行格式
 */
function toUpsertRows(data: {
  global: AggregateRow;
  byUser: Array<{ userId: string } & AggregateRow>;
  byModel: Array<{ modelId: string } & AggregateRow>;
}) {
  const rows: Array<{ userId: string | null; modelId: string | null } & AggregateRow> = [];

  // 全局行
  rows.push({ userId: null, modelId: null, ...data.global });

  // 按用户行
  for (const { userId, ...rest } of data.byUser) {
    rows.push({ userId, modelId: null, ...rest });
  }

  // 按模型行
  for (const { modelId, ...rest } of data.byModel) {
    rows.push({ userId: null, modelId, ...rest });
  }

  return rows;
}

/**
 * 聚合上一个完整小时的数据
 */
export async function aggregateHourly(db: Database): Promise<void> {
  const now = new Date();
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
  const periodStart = new Date(periodEnd.getTime() - 60 * 60 * 1000);

  console.log(`[cron] 小时聚合: ${periodStart.toISOString()} ~ ${periodEnd.toISOString()}`);

  const data = await aggregateFromLogs(db, periodStart, periodEnd);
  if (data.global.requestCount === 0) {
    console.log('[cron] 小时聚合: 无数据，跳过');
    return;
  }

  const rows = toUpsertRows(data);
  await upsertStats(db, 'hourly', periodStart, periodEnd, rows);
  console.log(`[cron] 小时聚合完成: ${rows.length} 行`);
}

/**
 * 聚合前一天的数据（优先从 hourly 聚合，回退到 usage_logs）
 */
export async function aggregateDaily(db: Database): Promise<void> {
  const now = new Date();
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const periodStart = new Date(periodEnd.getTime() - 24 * 60 * 60 * 1000);

  console.log(`[cron] 日聚合: ${periodStart.toISOString()} ~ ${periodEnd.toISOString()}`);

  let data = await aggregateFromStats(db, 'hourly', periodStart, periodEnd);
  if (!data) {
    console.log('[cron] 日聚合: 无小时数据，回退到 usage_logs');
    data = await aggregateFromLogs(db, periodStart, periodEnd);
  }

  if (data.global.requestCount === 0) {
    console.log('[cron] 日聚合: 无数据，跳过');
    return;
  }

  const rows = toUpsertRows(data);
  await upsertStats(db, 'daily', periodStart, periodEnd, rows);
  console.log(`[cron] 日聚合完成: ${rows.length} 行`);
}

/**
 * 聚合上一周的数据（周一到周日）
 */
export async function aggregateWeekly(db: Database): Promise<void> {
  const now = new Date();
  // 上周一 00:00 UTC
  const todayDay = now.getUTCDay();
  const daysToLastMonday = todayDay === 0 ? 6 : todayDay - 1;
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToLastMonday));
  const periodEnd = thisMonday;
  const periodStart = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);

  console.log(`[cron] 周聚合: ${periodStart.toISOString()} ~ ${periodEnd.toISOString()}`);

  let data = await aggregateFromStats(db, 'daily', periodStart, periodEnd);
  if (!data) {
    console.log('[cron] 周聚合: 无日数据，回退到 usage_logs');
    data = await aggregateFromLogs(db, periodStart, periodEnd);
  }

  if (data.global.requestCount === 0) {
    console.log('[cron] 周聚合: 无数据，跳过');
    return;
  }

  const rows = toUpsertRows(data);
  await upsertStats(db, 'weekly', periodStart, periodEnd, rows);
  console.log(`[cron] 周聚合完成: ${rows.length} 行`);
}

/**
 * 聚合上一个月的数据
 */
export async function aggregateMonthly(db: Database): Promise<void> {
  const now = new Date();
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  console.log(`[cron] 月聚合: ${periodStart.toISOString()} ~ ${periodEnd.toISOString()}`);

  let data = await aggregateFromStats(db, 'daily', periodStart, periodEnd);
  if (!data) {
    console.log('[cron] 月聚合: 无日数据，回退到 usage_logs');
    data = await aggregateFromLogs(db, periodStart, periodEnd);
  }

  if (data.global.requestCount === 0) {
    console.log('[cron] 月聚合: 无数据，跳过');
    return;
  }

  const rows = toUpsertRows(data);
  await upsertStats(db, 'monthly', periodStart, periodEnd, rows);
  console.log(`[cron] 月聚合完成: ${rows.length} 行`);
}
