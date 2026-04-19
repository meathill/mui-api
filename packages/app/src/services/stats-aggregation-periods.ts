export interface PeriodRange {
  start: Date;
  end: Date;
}

export function getPreviousHourlyPeriod(now: Date = new Date()): PeriodRange {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
  const start = new Date(end.getTime() - 60 * 60 * 1000);

  return { start, end };
}

export function getPreviousDailyPeriod(now: Date = new Date()): PeriodRange {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

  return { start, end };
}

export function getPreviousWeeklyPeriod(now: Date = new Date()): PeriodRange {
  const dayOfWeek = now.getUTCDay();
  const daysToCurrentMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysToCurrentMonday));
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

  return { start, end };
}

export function getPreviousMonthlyPeriod(now: Date = new Date()): PeriodRange {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  return { start, end };
}
