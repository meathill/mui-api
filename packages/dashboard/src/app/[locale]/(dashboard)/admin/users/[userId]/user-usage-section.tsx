'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { UsageLogTable } from '@/components/admin/usage-log-table';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { api, type Pagination, type UsageLog } from '@/lib/api';

const PAGE_SIZE = 10;

export interface UserUsageSectionProps {
  userId: string;
}

export function UserUsageSection({ userId }: UserUsageSectionProps) {
  const t = useTranslations('adminUserDetail');
  const te = useTranslations('errors');
  const tc = useTranslations('common');
  const ta = useTranslations('adminUsage');

  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLogs = useCallback(
    async (targetPage: number) => {
      try {
        setLoading(true);
        const data = await api.getUsage({ userId, page: targetPage, pageSize: PAGE_SIZE });
        setLogs(data.logs);
        setPagination(data.pagination);
      } catch (e) {
        setError(e instanceof Error ? e.message : te('loadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [userId, te],
  );

  useEffect(() => {
    loadLogs(page);
  }, [page, loadLogs]);

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">{t('sectionUsage')}</h3>
        <Link href={`/admin/usage?userId=${userId}`} className="text-sm text-primary hover:underline">
          {t('viewAll')}
        </Link>
      </div>
      {error && <p className="text-destructive mb-3">{error}</p>}
      {loading ? (
        <p className="text-muted-foreground">{tc('loading')}</p>
      ) : (
        <>
          <UsageLogTable logs={logs} showUserColumn={false} />
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-sm text-muted-foreground">
                {ta('pagination', {
                  total: pagination.total,
                  page: pagination.page,
                  totalPages: pagination.totalPages,
                })}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                  {ta('prev')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= pagination.totalPages}
                >
                  {ta('next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
