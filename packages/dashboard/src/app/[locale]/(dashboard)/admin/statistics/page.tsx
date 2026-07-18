'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { Link } from '@/i18n/navigation';
import { api, type StatisticsResponse } from '@/lib/api';
import { formatDate, formatPeriodLabel, TIME_RANGES, type TimeRange } from '@/lib/date-ranges';

// recharts 体积较大且仅在有数据时渲染，按需加载避免首屏阻塞。
const CostTrendChart = dynamic(() => import('@/components/admin/cost-trend-chart'), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full animate-pulse rounded bg-muted/40" />,
});

type StatisticsData = Omit<StatisticsResponse, 'success'>;

export default function StatisticsPage() {
  const t = useTranslations('adminStats');
  const tc = useTranslations('common');

  // 筛选
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return formatDate(d);
  });
  const [endDate, setEndDate] = useState(() => formatDate(new Date()));
  const [userId, setUserId] = useState('');
  const [activeRange, setActiveRange] = useState('last7days');

  const fetchStatistics = useCallback(
    () => api.getStatistics({ startDate, endDate, userId: userId || undefined }),
    [startDate, endDate, userId],
  );
  const { data, loading, error, reload } = useAsyncResource<StatisticsData | null>(fetchStatistics, null);

  function handleRangeClick(range: TimeRange) {
    const { startDate: s, endDate: e } = range.getDates();
    setStartDate(s);
    setEndDate(e);
    setActiveRange(range.key);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setActiveRange('');
    reload();
  }

  // 图表数据格式化
  const chartData = (data?.timeSeries ?? []).map((item) => ({
    name: formatPeriodLabel(item.periodStart),
    cost: Number(item.totalCost.toFixed(4)),
    requests: item.requestCount,
  }));

  return (
    <div>
      <PageHeader eyebrow="Admin · Statistics" title={t('title')} />

      {/* 时间范围快捷选择 */}
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

      {/* 自定义筛选 */}
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
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('userId')}</label>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder={t('optional')} />
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
        <p className="text-muted-foreground">{tc('loading')}</p>
      ) : data ? (
        <>
          {/* 概览卡片 */}
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

          {/* 趋势图 */}
          {chartData.length > 1 && (
            <Card className="p-4 mb-4">
              <h3 className="font-medium mb-3">{t('costTrend')}</h3>
              <CostTrendChart data={chartData} costLabel={t('costLabel')} />
            </Card>
          )}

          {/* 模型分布 */}
          {data.byModel.length > 0 && (
            <Card className="p-4 mb-4">
              <h3 className="font-medium mb-3">{t('modelDistribution')}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('colModel')}</TableHead>
                    <TableHead className="text-right">{t('colCost')}</TableHead>
                    <TableHead className="text-right">{t('colRequests')}</TableHead>
                    <TableHead className="text-right">{t('colInputTokens')}</TableHead>
                    <TableHead className="text-right">{t('colOutputTokens')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byModel.map((row) => (
                    <TableRow key={row.modelId}>
                      <TableCell>{row.modelId || '-'}</TableCell>
                      <TableCell className="text-right font-mono">${row.totalCost.toFixed(4)}</TableCell>
                      <TableCell className="text-right font-mono">{row.requestCount.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">{row.totalInputTokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">{row.totalOutputTokens.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* 用户排行 */}
          {data.byUser.length > 0 && (
            <Card className="p-4">
              <h3 className="font-medium mb-3">{t('userRanking')}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('colUser')}</TableHead>
                    <TableHead className="text-right">{t('colCost')}</TableHead>
                    <TableHead className="text-right">{t('colRequests')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byUser.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell className="text-xs">
                        {row.userId ? (
                          <Link href={`/admin/users/${row.userId}`} className="text-primary hover:underline">
                            {row.email || row.userId}
                          </Link>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">${row.totalCost.toFixed(4)}</TableCell>
                      <TableCell className="text-right font-mono">{row.requestCount.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
