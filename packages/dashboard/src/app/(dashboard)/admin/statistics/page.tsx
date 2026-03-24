'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api, type StatisticsResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface TimeRange {
  label: string;
  getDates: () => { startDate: string; endDate: string };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const TIME_RANGES: TimeRange[] = [
  {
    label: '今天',
    getDates: () => {
      const today = formatDate(new Date());
      return { startDate: today, endDate: today };
    },
  },
  {
    label: '昨天',
    getDates: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yesterday = formatDate(d);
      return { startDate: yesterday, endDate: yesterday };
    },
  },
  {
    label: '近 7 天',
    getDates: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 6);
      return { startDate: formatDate(start), endDate: formatDate(end) };
    },
  },
  {
    label: '近 30 天',
    getDates: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);
      return { startDate: formatDate(start), endDate: formatDate(end) };
    },
  },
  {
    label: '本月',
    getDates: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: formatDate(start), endDate: formatDate(now) };
    },
  },
  {
    label: '上月',
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
  const [activeRange, setActiveRange] = useState('近 7 天');

  async function loadStatistics(start: string, end: string, uid?: string) {
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
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatistics(startDate, endDate, userId);
  }, []);

  function handleRangeClick(range: TimeRange) {
    const { startDate: s, endDate: e } = range.getDates();
    setStartDate(s);
    setEndDate(e);
    setActiveRange(range.label);
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
      <h2 className="text-xl font-bold mb-4">统计分析</h2>

      {/* 时间范围快捷选择 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TIME_RANGES.map((range) => (
          <Button
            key={range.label}
            variant={activeRange === range.label ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleRangeClick(range)}
          >
            {range.label}
          </Button>
        ))}
      </div>

      {/* 自定义筛选 */}
      <Card className="p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">开始日期</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">结束日期</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">用户 ID</label>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="可选" />
          </div>
          <Button type="submit">查询</Button>
        </form>
      </Card>

      {data?.source === 'realtime' && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-2 rounded mb-4">
          当前数据为实时查询，聚合任务启动后将使用预计算数据
        </div>
      )}

      {error && <p className="text-destructive mb-4">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : data ? (
        <>
          {/* 概览卡片 */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">总费用</p>
              <p className="text-2xl font-bold font-mono">${data.overview.totalCost.toFixed(4)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">总请求</p>
              <p className="text-2xl font-bold font-mono">{data.overview.requestCount.toLocaleString()}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">总输入 Token</p>
              <p className="text-2xl font-bold font-mono">{data.overview.totalInputTokens.toLocaleString()}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">总输出 Token</p>
              <p className="text-2xl font-bold font-mono">{data.overview.totalOutputTokens.toLocaleString()}</p>
            </Card>
          </div>

          {/* 趋势图 */}
          {chartData.length > 1 && (
            <Card className="p-4 mb-6">
              <h3 className="font-medium mb-3">费用趋势</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="cost" stroke="hsl(var(--primary))" name="费用 ($)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* 模型分布 */}
          {data.byModel.length > 0 && (
            <Card className="p-4 mb-6">
              <h3 className="font-medium mb-3">模型分布</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>模型</TableHead>
                    <TableHead className="text-right">费用</TableHead>
                    <TableHead className="text-right">请求数</TableHead>
                    <TableHead className="text-right">输入 Token</TableHead>
                    <TableHead className="text-right">输出 Token</TableHead>
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
              <h3 className="font-medium mb-3">用户排行（Top 20）</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead className="text-right">费用</TableHead>
                    <TableHead className="text-right">请求数</TableHead>
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
