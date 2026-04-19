import type { Database } from '../db';
import { aggregateStatsForPeriod } from './stats-aggregation-core';
import {
  getPreviousDailyPeriod,
  getPreviousHourlyPeriod,
  getPreviousMonthlyPeriod,
  getPreviousWeeklyPeriod,
} from './stats-aggregation-periods';

/**
 * 聚合上一个完整小时的数据
 */
export async function aggregateHourly(db: Database): Promise<void> {
  await aggregateStatsForPeriod({
    db,
    granularity: 'hourly',
    label: '小时聚合',
    period: getPreviousHourlyPeriod(),
  });
}

/**
 * 聚合前一天的数据（优先从 hourly 聚合，回退到 usage_logs）
 */
export async function aggregateDaily(db: Database): Promise<void> {
  await aggregateStatsForPeriod({
    db,
    granularity: 'daily',
    label: '日聚合',
    period: getPreviousDailyPeriod(),
    sourceGranularity: 'hourly',
  });
}

/**
 * 聚合上一周的数据（周一到周日）
 */
export async function aggregateWeekly(db: Database): Promise<void> {
  await aggregateStatsForPeriod({
    db,
    granularity: 'weekly',
    label: '周聚合',
    period: getPreviousWeeklyPeriod(),
    sourceGranularity: 'daily',
  });
}

/**
 * 聚合上一个月的数据
 */
export async function aggregateMonthly(db: Database): Promise<void> {
  await aggregateStatsForPeriod({
    db,
    granularity: 'monthly',
    label: '月聚合',
    period: getPreviousMonthlyPeriod(),
    sourceGranularity: 'daily',
  });
}
