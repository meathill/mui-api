'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  api,
  type Pagination,
  type UsageLog,
  type UsageQueryParams,
  type UsageSummary,
  type UserInfo,
} from '@/lib/api';

export default function UsagePage() {
  const t = useTranslations('adminUsage');
  const te = useTranslations('errors');
  const tc = useTranslations('common');

  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 用户映射：userId -> email
  const [users, setUsers] = useState<UserInfo[]>([]);
  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      map.set(u.userId, u.email);
    }
    return map;
  }, [users]);

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
      setError(e instanceof Error ? e.message : te('loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsage(filters);
  }, [filters, loadUsage]);

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

  const [summary, setSummary] = useState<UsageSummary>({ cost: 0, inputTokens: 0, outputTokens: 0, requests: 0 });

  useEffect(() => {
    api
      .getUsageSummary()
      .then((data) => setSummary(data.summary))
      .catch(() => {});
  }, []);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{t('title')}</h2>

      {/* 今日汇总 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t('todayCost')}</p>
          <p className="text-2xl font-bold font-mono">${summary.cost.toFixed(4)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t('todayInput')}</p>
          <p className="text-2xl font-bold font-mono">{summary.inputTokens.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t('todayOutput')}</p>
          <p className="text-2xl font-bold font-mono">{summary.outputTokens.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{t('todayRequests')}</p>
          <p className="text-2xl font-bold font-mono">{summary.requests.toLocaleString()}</p>
        </Card>
      </div>

      {/* 筛选 */}
      <Card className="p-4 mb-6">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('userId')}</label>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder={t('optional')} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t('model')}</label>
            <Input value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder={t('optional')} />
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

      {/* 用量列表 */}
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
                  <TableHead>{t('colModel')}</TableHead>
                  <TableHead className="text-right">{t('colInput')}</TableHead>
                  <TableHead className="text-right">{t('colOutput')}</TableHead>
                  <TableHead className="text-right">{t('colCost')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground text-xs">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="text-xs" title={log.userId || ''}>
                      {log.userId ? userMap.get(log.userId) || `${log.userId.slice(0, 8)}...` : '-'}
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
