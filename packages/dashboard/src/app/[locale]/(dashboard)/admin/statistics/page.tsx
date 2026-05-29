'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, type StatisticsResponse } from '@/lib/api';

// recharts 体积较大且仅在有数据时渲染，按需加载避免首屏阻塞。
const CostTrendChart = dynamic(() => import('@/components/admin/cost-trend-chart'), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full animate-pulse rounded bg-muted/40" />,
});

interface TimeRange {
  key: string;
  getDates: () => { startDate: string; endDate: string };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const _TIME_RANGE_KEYS = ['today', 'yesterday', 'last7days', 'last30days', 'thisMonth', 'lastMonth'] as const;

const TIME_RANGES: TimeRange[] = [
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

type StatisticsData = Omit<StatisticsResponse, 'success'>;

export default function StatisticsPage() {
  const t = useTranslations('adminStats');
  const te = useTranslations('errors');
  const tc = useTranslations('common');

  const [data, setData] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 筛选
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return formatDate(d);
  });
  const [endDate, setEndDate] = useState(() => formatDate(new Date()));
  const [userId, setUserId] = useState('');
  const [activeRange, setActiveRange] = useState('last7days');

  const loadStatistics = useCallback(
    async (start: string, end: string, uid?: string) => {
      try {
        setLoading(true);
        setError('');
        const result = await api.getStatistics({
          startDate: start,
          endDate: end,
          userId: uid || undefined,
        });
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : te('loadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [te],
  );

  useEffect(() => {
    loadStatistics(startDate, endDate, userId);
  }, [endDate, loadStatistics, startDate, userId]);

  function handleRangeClick(range: TimeRange) {
    const { startDate: s, endDate: e } = range.getDates();
    setStartDate(s);
    setEndDate(e);
    setActiveRange(range.key);
    loadStatistics(s, e, userId);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setActiveRange('');
    loadStatistics(startDate, endDate, userId);
  }

  // 图表数据格式化
  const chartData = (data?.timeSeries ?? []).map((item) => {
    let label: string;
    if (typeof item.periodStart === 'string') {
      label = item.periodStart;
    } else if (typeof item.periodStart === 'number') {
      const d = new Date(item.periodStart * 1000);
      label = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:00`;
    } else {
      label = '-';
    }
    return {
      name: label,
      cost: Number(item.totalCost.toFixed(4)),
      requests: item.requestCount,
    };
  });

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
                      <TableCell className="text-xs">{row.email || row.userId || '-'}</TableCell>
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
