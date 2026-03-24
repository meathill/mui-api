'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type UserInfo, type RechargeLogItem, type Pagination } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function RechargeLogsPage() {
  const [logs, setLogs] = useState<RechargeLogItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 用户映射
  const [users, setUsers] = useState<UserInfo[]>([]);
  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      map.set(u.userId, u.email);
    }
    return map;
  }, [users]);

  // 筛选
  const [userId, setUserId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filters, setFilters] = useState<{
    userId?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    pageSize: number;
  }>({ page: 1, pageSize: 20 });

  async function loadLogs(params: typeof filters) {
    try {
      setLoading(true);
      const data = await api.getRechargeLogs(params);
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs(filters);
  }, [filters]);

  useEffect(() => {
    api
      .getUsers()
      .then((data) => setUsers(data.users))
      .catch(() => {});
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setFilters({
      userId: userId || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: 1,
      pageSize: 20,
    });
  }

  function handleReset() {
    setUserId('');
    setStartDate('');
    setEndDate('');
    setFilters({ page: 1, pageSize: 20 });
  }

  function goToPage(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">充值记录</h2>

      {/* 筛选 */}
      <Card className="p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">用户 ID / 邮箱</label>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="可选" />
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

      {/* 列表 */}
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
                  <TableHead>操作者</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead className="text-right">充值后余额</TableHead>
                  <TableHead>备注</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString('zh-CN') : '-'}
                    </TableCell>
                    <TableCell className="text-xs" title={log.userId}>
                      {userMap.get(log.userId) || log.userId}
                    </TableCell>
                    <TableCell className="text-xs" title={log.operatorId || ''}>
                      {log.operatorId ? userMap.get(log.operatorId) || log.operatorId : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">${log.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {log.balanceAfter != null ? `$${log.balanceAfter.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{log.note || '-'}</TableCell>
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
