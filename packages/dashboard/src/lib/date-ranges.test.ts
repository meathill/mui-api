import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDate, formatPeriodLabel, TIME_RANGES } from './date-ranges';

// TIME_RANGES 内部混用本地时区的 getDate()/getMonth() 和基于 UTC 的 formatDate，
// 钉死 TZ 避免测试结果随运行环境时区漂移（尤其是 UTC+12~+14 会导致本地日期跨天）。
const originalTz = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'UTC';
});

afterAll(() => {
  process.env.TZ = originalTz;
});

function getRange(key: string) {
  const range = TIME_RANGES.find((r) => r.key === key);
  if (!range) throw new Error(`未找到时间范围: ${key}`);
  return range.getDates();
}

describe('formatDate', () => {
  it('格式化为 YYYY-MM-DD', () => {
    expect(formatDate(new Date('2026-07-09T15:30:00Z'))).toBe('2026-07-09');
  });

  it('个位数月份/日期补零', () => {
    expect(formatDate(new Date('2026-01-05T00:00:00Z'))).toBe('2026-01-05');
  });
});

describe('formatPeriodLabel', () => {
  it('字符串型 periodStart 原样返回', () => {
    expect(formatPeriodLabel('2026-07-09')).toBe('2026-07-09');
  });

  it('数字型 periodStart 按小时格式化（epoch 秒）', () => {
    const epochSeconds = Date.UTC(2026, 6, 9, 8, 0, 0) / 1000;
    expect(formatPeriodLabel(epochSeconds)).toBe('07-09 08:00');
  });

  it('null 返回占位符', () => {
    expect(formatPeriodLabel(null)).toBe('-');
  });
});

describe('TIME_RANGES', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('today：起止日期相同', () => {
    vi.setSystemTime(new Date('2026-07-09T12:00:00Z'));
    expect(getRange('today')).toEqual({ startDate: '2026-07-09', endDate: '2026-07-09' });
  });

  it('yesterday：昨天', () => {
    vi.setSystemTime(new Date('2026-07-09T12:00:00Z'));
    expect(getRange('yesterday')).toEqual({ startDate: '2026-07-08', endDate: '2026-07-08' });
  });

  it('yesterday：跨月边界', () => {
    vi.setSystemTime(new Date('2026-08-01T12:00:00Z'));
    expect(getRange('yesterday')).toEqual({ startDate: '2026-07-31', endDate: '2026-07-31' });
  });

  it('last7days：含今天在内共 7 天', () => {
    vi.setSystemTime(new Date('2026-07-09T12:00:00Z'));
    expect(getRange('last7days')).toEqual({ startDate: '2026-07-03', endDate: '2026-07-09' });
  });

  it('last30days：含今天在内共 30 天', () => {
    vi.setSystemTime(new Date('2026-07-09T12:00:00Z'));
    expect(getRange('last30days')).toEqual({ startDate: '2026-06-10', endDate: '2026-07-09' });
  });

  it('thisMonth：本月 1 号到今天', () => {
    vi.setSystemTime(new Date('2026-07-09T12:00:00Z'));
    expect(getRange('thisMonth')).toEqual({ startDate: '2026-07-01', endDate: '2026-07-09' });
  });

  it('lastMonth：上月整月', () => {
    vi.setSystemTime(new Date('2026-07-09T12:00:00Z'));
    expect(getRange('lastMonth')).toEqual({ startDate: '2026-06-01', endDate: '2026-06-30' });
  });

  it('lastMonth：跨年边界（1 月的上月是去年 12 月）', () => {
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
    expect(getRange('lastMonth')).toEqual({ startDate: '2025-12-01', endDate: '2025-12-31' });
  });
});
