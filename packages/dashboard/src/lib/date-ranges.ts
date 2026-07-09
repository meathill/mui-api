export interface TimeRange {
  key: string;
  getDates: () => { startDate: string; endDate: string };
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatPeriodLabel(periodStart: string | number | null): string {
  if (typeof periodStart === 'string') {
    return periodStart;
  }
  if (typeof periodStart === 'number') {
    const d = new Date(periodStart * 1000);
    return `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:00`;
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
      d.setDate(d.getDate() - 1);
      const yesterday = formatDate(d);
      return { startDate: yesterday, endDate: yesterday };
    },
  },
  {
    key: 'last7days',
    getDates: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);
      return { startDate: formatDate(start), endDate: formatDate(end) };
    },
  },
  {
    key: 'last30days',
    getDates: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);
      return { startDate: formatDate(start), endDate: formatDate(end) };
    },
  },
  {
    key: 'thisMonth',
    getDates: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: formatDate(start), endDate: formatDate(now) };
    },
  },
  {
    key: 'lastMonth',
    getDates: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: formatDate(start), endDate: formatDate(end) };
    },
  },
];
