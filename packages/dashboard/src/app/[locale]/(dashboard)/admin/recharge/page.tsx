'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RechargeLogTable } from '@/components/admin/recharge-log-table';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api, type Pagination, type RechargeLogItem, type UserInfo } from '@/lib/api';

export default function RechargeLogsPage() {
  const t = useTranslations('adminRecharge');
  const te = useTranslations('errors');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const initialUserId = searchParams.get('userId') ?? '';

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

  // 筛选（userId 支持从 URL 参数预填，供用户详情页的"查看全部"链接跳转定位）
  const [userId, setUserId] = useState(initialUserId);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filters, setFilters] = useState<{
    userId?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    pageSize: number;
  }>({ userId: initialUserId || undefined, page: 1, pageSize: 20 });

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
      <PageHeader eyebrow="Admin · Recharge" title={t('title')} />

      {/* 筛选 */}
      <Card className="p-4 mb-4">
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
          <RechargeLogTable logs={logs} userMap={userMap} />

          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
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
