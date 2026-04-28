'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, type Pagination, type RechargeLogItem, type UserInfo } from '@/lib/api';

export default function RechargeLogsPage() {
  const t = useTranslations('adminRecharge');
  const te = useTranslations('errors');
  const tc = useTranslations('common');

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

  const loadLogs = useCallback(
    async (params: typeof filters) => {
      try {
        setLoading(true);
        const data = await api.getRechargeLogs(params);
        setLogs(data.logs);
        setPagination(data.pagination);
      } catch (e) {
        setError(e instanceof Error ? e.message : te('loadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [te],
  );

  useEffect(() => {
    loadLogs(filters);
  }, [filters, loadLogs]);

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
      <h2 className="text-xl font-bold mb-4">{t('title')}</h2>

      {/* 筛选 */}
      <Card className="p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('userIdOrEmail')}</label>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder={t('optional')} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('startDate')}</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('endDate')}</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Button type="submit">{t('search')}</Button>
          <Button type="button" variant="outline" onClick={handleReset}>
            {t('reset')}
          </Button>
        </form>
      </Card>

      {/* 列表 */}
      {error && <p className="text-destructive mb-4">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground">{tc('loading')}</p>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('colTime')}</TableHead>
                  <TableHead>{t('colUser')}</TableHead>
                  <TableHead>{t('colOperator')}</TableHead>
                  <TableHead className="text-right">{t('colAmount')}</TableHead>
                  <TableHead className="text-right">{t('colBalanceAfter')}</TableHead>
                  <TableHead>{t('colNote')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
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
                      {t('empty')}
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
                {t('pagination', { total: pagination.total, page: pagination.page, totalPages: pagination.totalPages })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  {t('prev')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  {t('next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
