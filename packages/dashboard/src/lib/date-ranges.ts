export interface TimeRange {
  key: string;
  getDates: () => { startDate: string; endDate: string };
}

export function formatDate(d: Date): string {
  const year = d.getUTCFullYear();
  const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const date = d.getUTCDate().toString().padStart(2, '0');
  return `${year}-${month}-${date}`;
}

export function formatPeriodLabel(periodStart: string | number | null): string {
  if (typeof periodStart === 'string') {
    // 后端聚合返回的 ISO 字符串（含 T）统一按 UTC 取日期部分，避免显示 2026-08-30T00:00:00.000Z
    if (periodStart.includes('T')) {
      return periodStart.slice(0, 10);
    }
    return periodStart;
  }
  if (typeof periodStart === 'number') {
    const d = new Date(periodStart * 1000);
    return `${(d.getUTCMonth() + 1).toString().padStart(2, '0')}-${d.getUTCDate().toString().padStart(2, '0')} ${d.getUTCHours().toString().padStart(2, '0')}:00`;
  }
  return '-';
}

export const TIME_RANGES: TimeRange[] = [
  {
    key: 'today',
    getDates: () => {
      const today = formatDate(new Date());
      return { startDate: today, endDate: today };
    },
  },
  {
    key: 'yesterday',
    getDates: () => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 1);
      const yesterday = formatDate(d);
      return { startDate: yesterday, endDate: yesterday };
    },
  },
  {
    key: 'last7days',
    getDates: () => {
      const end = new Date();
      const start = new Date();
      start.setUTCDate(start.getUTCDate() - 6);
      return { startDate: formatDate(start), endDate: formatDate(end) };
    },
  },
  {
    key: 'last30days',
    getDates: () => {
      const end = new Date();
      const start = new Date();
      start.setUTCDate(start.getUTCDate() - 29);
      return { startDate: formatDate(start), endDate: formatDate(end) };
    },
  },
  {
    key: 'thisMonth',
    getDates: () => {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return { startDate: formatDate(start), endDate: formatDate(now) };
    },
  },
  {
    key: 'lastMonth',
    getDates: () => {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
      return { startDate: formatDate(start), endDate: formatDate(end) };
    },
  },
];
