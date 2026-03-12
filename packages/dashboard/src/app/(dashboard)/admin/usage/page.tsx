'use client';

import { useEffect, useState } from 'react';
import { api, type UsageLog, type UsageQueryParams, type Pagination } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function UsagePage() {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState<UsageQueryParams>({
    page: 1,
    pageSize: 20,
  });
  const [userId, setUserId] = useState('');
  const [modelId, setModelId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  async function loadUsage(params: UsageQueryParams) {
    try {
      setLoading(true);
      const data = await api.getUsage(params);
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsage(filters);
  }, [filters]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters({
      userId: userId || undefined,
      modelId: modelId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: 1,
      pageSize: 20,
    });
  }

  function handleReset() {
    setUserId('');
    setModelId('');
    setStartDate('');
    setEndDate('');
    setFilters({ page: 1, pageSize: 20 });
  }

  function goToPage(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  const totalCost = logs.reduce((sum, log) => sum + (log.cost ?? 0), 0);
  const totalInput = logs.reduce((sum, log) => sum + (log.inputTokens ?? 0), 0);
  const totalOutput = logs.reduce((sum, log) => sum + (log.outputTokens ?? 0), 0);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">用量统计</h2>

      {/* 汇总卡片 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">本页总费用</p>
          <p className="text-2xl font-bold font-mono">${totalCost.toFixed(4)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">输入 Tokens</p>
          <p className="text-2xl font-bold font-mono">{totalInput.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">输出 Tokens</p>
          <p className="text-2xl font-bold font-mono">{totalOutput.toLocaleString()}</p>
        </Card>
      </div>

      {/* 筛选 */}
      <Card className="p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">用户 ID</label>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="可选" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">模型</label>
            <Input value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="可选" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">开始日期</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">结束日期</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Button type="submit">查询</Button>
          <Button type="button" variant="outline" onClick={handleReset}>
            重置
          </Button>
        </form>
      </Card>

      {/* 用量列表 */}
      {error && <p className="text-destructive mb-4">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead>模型</TableHead>
                  <TableHead className="text-right">输入</TableHead>
                  <TableHead className="text-right">输出</TableHead>
                  <TableHead className="text-right">费用</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString('zh-CN') : '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.userId ? `${log.userId.slice(0, 8)}...` : '-'}
                    </TableCell>
                    <TableCell>{log.modelId || '-'}</TableCell>
                    <TableCell className="text-right font-mono">{log.inputTokens?.toLocaleString() ?? '-'}</TableCell>
                    <TableCell className="text-right font-mono">{log.outputTokens?.toLocaleString() ?? '-'}</TableCell>
                    <TableCell className="text-right font-mono">${log.cost?.toFixed(4) ?? '-'}</TableCell>
                  </TableRow>
                ))}
                {logs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      暂无记录
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                共 {pagination.total} 条，第 {pagination.page}/{pagination.totalPages} 页
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
