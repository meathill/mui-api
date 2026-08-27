'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TableSkeleton } from '@/components/admin/admin-skeletons';
import { RechargeLogTable } from '@/components/admin/recharge-log-table';
import { Button } from '@/components/ui/button';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { Link } from '@/i18n/navigation';
import { api, type Pagination, type RechargeLogItem, type UserInfo } from '@/lib/api';

const PAGE_SIZE = 10;
const EMPTY_PAGINATION: Pagination = { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 0 };

export interface UserRechargeSectionProps {
  userId: string;
}

export function UserRechargeSection({ userId }: UserRechargeSectionProps) {
  const t = useTranslations('adminUserDetail');
  const tc = useTranslations('common');
  const ta = useTranslations('adminRecharge');

  const [page, setPage] = useState(1);

  // 操作者（管理员）邮箱映射，与「用户是谁」是两个不同维度
  const [users, setUsers] = useState<UserInfo[]>([]);
  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) map.set(u.userId, u.email);
    return map;
  }, [users]);

  const fetchLogs = useCallback(() => api.getRechargeLogs({ userId, page, pageSize: PAGE_SIZE }), [userId, page]);
  const {
    data: { logs, pagination },
    loading,
    error,
  } = useAsyncResource(fetchLogs, { logs: [] as RechargeLogItem[], pagination: EMPTY_PAGINATION });

  useEffect(() => {
    api
      .getUsers()
      .then((data) => setUsers(data.users))
      .catch(() => {});
  }, []);

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">{t('sectionRecharge')}</h3>
        <Link href={`/admin/recharge?userId=${userId}`} className="text-sm text-primary hover:underline">
          {t('viewAll')}
        </Link>
      </div>
      {error && <p className="text-destructive mb-3">{error}</p>}
      {loading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : (
        <>
          <RechargeLogTable logs={logs} userMap={userMap} showUserColumn={false} />
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
