import { describe, expect, it } from 'vitest';
import {
  getPreviousDailyPeriod,
  getPreviousHourlyPeriod,
  getPreviousMonthlyPeriod,
  getPreviousWeeklyPeriod,
} from './stats-aggregation-periods';

describe('stats-aggregation-periods', () => {
  it('应返回上一个完整小时', () => {
    const now = new Date('2026-04-19T08:37:12.000Z');
    const period = getPreviousHourlyPeriod(now);

    expect(period.start.toISOString()).toBe('2026-04-19T07:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-04-19T08:00:00.000Z');
  });

  it('应返回前一天的 UTC 自然日', () => {
    const now = new Date('2026-04-19T08:37:12.000Z');
    const period = getPreviousDailyPeriod(now);

    expect(period.start.toISOString()).toBe('2026-04-18T00:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-04-19T00:00:00.000Z');
  });

  it('应在周日正确回退到上一个完整周', () => {
    const now = new Date('2026-04-19T08:37:12.000Z');
    const period = getPreviousWeeklyPeriod(now);

    expect(period.start.toISOString()).toBe('2026-04-06T00:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-04-13T00:00:00.000Z');
  });

  it('应返回上一个完整月', () => {
    const now = new Date('2026-04-19T08:37:12.000Z');
    const period = getPreviousMonthlyPeriod(now);

    expect(period.start.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(period.end.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });
});
