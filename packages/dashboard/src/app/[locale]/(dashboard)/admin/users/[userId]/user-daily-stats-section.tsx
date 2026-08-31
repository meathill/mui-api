'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { CardSkeleton, TableSkeleton } from '@/components/admin/admin-skeletons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { api, type StatisticsResponse } from '@/lib/api';
import { formatDate, formatPeriodLabel, TIME_RANGES, type TimeRange } from '@/lib/date-ranges';

// recharts 体积较大且仅在有数据时渲染，按需加载避免首屏阻塞。
const CostTrendChart = dynamic(() => import('@/components/admin/cost-trend-chart'), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full animate-pulse rounded bg-muted/40" />,
});

type StatisticsData = Omit<StatisticsResponse, 'success'>;

export interface UserDailyStatsSectionProps {
  userId: string;
}

export function UserDailyStatsSection({ userId }: UserDailyStatsSectionProps) {
  const t = useTranslations('adminStats');
  const tud = useTranslations('adminUserDetail');
  const tc = useTranslations('common');

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return formatDate(d);
  });
  const [endDate, setEndDate] = useState(() => formatDate(new Date()));
  const [activeRange, setActiveRange] = useState('last7days');

  const fetchStatistics = useCallback(
    () => api.getStatistics({ startDate, endDate, granularity: 'daily', userId }),
    [startDate, endDate, userId],
  );
  const { data, loading, error, reload } = useAsyncResource<StatisticsData | null>(fetchStatistics, null);

  function handleRangeClick(range: TimeRange) {
    const { startDate: s, endDate: e } = range.getDates();
    setStartDate(s);
    setEndDate(e);
    setActiveRange(range.key);
  }

  // 快捷范围只更新日期状态，靠 fetchStatistics 引用变化自动重新请求；
  // 手动查询（日期没变也要能重新查）直接调用 reload 主动触发。
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setActiveRange('');
    reload();
  }

  // 按 UTC 补零：保证 7 天查 7 行，避免“只有一天有数”的错觉，且与用量统计口径一致
  const filledTimeSeries = (() => {
    if (!data) return [];
    const map = new Map<string, (typeof data.timeSeries)[number]>();
    for (const item of data.timeSeries) {
      const key = formatPeriodLabel(item.periodStart as string | number | null);
      map.set(key, item);
    }
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return data.timeSeries;
    }
    const out: typeof data.timeSeries = [];
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = formatDate(d);
      const hit = map.get(key);
      if (hit) out.push(hit);
      else out.push({ periodStart: key, totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, requestCount: 0 });
    }
    return out;
  })();

  const chartData = filledTimeSeries.map((item) => ({
    name: formatPeriodLabel(item.periodStart),
    cost: Number(item.totalCost.toFixed(4)),
    requests: item.requestCount,
  }));

  return (
    <section className="mb-6">
      <h3 className="font-medium mb-3">{tud('sectionDaily')}</h3>

      <div className="flex flex-wrap gap-2 mb-4">
        {TIME_RANGES.map((range) => (
          <Button
            key={range.key}
            variant={activeRange === range.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleRangeClick(range)}
          >
            {t(range.key)}
          </Button>
        ))}
      </div>

      <Card className="p-4 mb-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('startDate')}</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('endDate')}</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
          <Button type="submit">{t('search')}</Button>
        </form>
      </Card>

      {data?.source === 'realtime' && (
        <div className="bg-[var(--brand-fluff)] border border-[var(--brand-corgi)] text-[var(--brand-yellow-deep)] text-sm px-4 py-2 rounded mb-4">
          {t('realtimeNotice')}
        </div>
      )}

      {error && <p className="text-destructive mb-4">{error}</p>}
      {loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <TableSkeleton rows={6} cols={5} />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">{t('totalCost')}</p>
              <p className="font-heading text-2xl font-bold tracking-tight">${data.overview.totalCost.toFixed(4)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">{t('totalRequests')}</p>
              <p className="font-heading text-2xl font-bold tracking-tight">
                {data.overview.requestCount.toLocaleString()}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">{t('totalInputTokens')}</p>
              <p className="font-heading text-2xl font-bold tracking-tight">
                {data.overview.totalInputTokens.toLocaleString()}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">{t('totalOutputTokens')}</p>
              <p className="font-heading text-2xl font-bold tracking-tight">
                {data.overview.totalOutputTokens.toLocaleString()}
              </p>
            </Card>
          </div>

          {chartData.length > 1 && (
            <Card className="p-4 mb-4">
              <h4 className="font-medium mb-3">{t('costTrend')}</h4>
              <CostTrendChart data={chartData} costLabel={t('costLabel')} />
            </Card>
          )}

          <Card className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tud('colDate')}</TableHead>
                  <TableHead className="text-right">{t('colRequests')}</TableHead>
                  <TableHead className="text-right">{t('colInputTokens')}</TableHead>
                  <TableHead className="text-right">{t('colOutputTokens')}</TableHead>
                  <TableHead className="text-right">{t('colCost')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filledTimeSeries.map((item) => (
                  <TableRow key={String(item.periodStart)}>
                    <TableCell>{formatPeriodLabel(item.periodStart)}</TableCell>
                    <TableCell className="text-right font-mono">{item.requestCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">{item.totalInputTokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">{item.totalOutputTokens.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">${item.totalCost.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
                {filledTimeSeries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {tud('emptyDaily')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : null}
    </section>
  );
}
