'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { UserDetailSkeleton } from '@/components/admin/admin-skeletons';
import { PageHeader } from '@/components/page-header';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { Link } from '@/i18n/navigation';
import { api, type UserInfo } from '@/lib/api';
import { UserBalanceAdjustDialog } from './user-balance-adjust-dialog';
import { UserDailyStatsSection } from './user-daily-stats-section';
import { UserProfileCard } from './user-profile-card';
import { UserRechargeSection } from './user-recharge-section';
import { UserUsageSection } from './user-usage-section';

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const t = useTranslations('adminUserDetail');
  const tc = useTranslations('common');

  const fetchUser = useCallback(async () => (await api.getUser({ userId })).user, [userId]);
  const { data: user, loading, error, reload: reloadUser } = useAsyncResource<UserInfo | null>(fetchUser, null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [rechargeKey, setRechargeKey] = useState(0);

  return (
    <div>
      <div className="mb-3">
        <Link href="/admin/users" className="text-sm text-primary hover:underline">
          {t('backToList')}
        </Link>
      </div>
      <PageHeader eyebrow="Admin · Users" title={t('title')} description={user?.email} />

      {error && <p className="text-destructive mb-4">{error}</p>}
      {loading ? (
        <UserDetailSkeleton />
      ) : user ? (
        <>
          <UserProfileCard user={user} onAdjustBalance={() => setAdjustOpen(true)} />
          <UserBalanceAdjustDialog
            open={adjustOpen}
            onOpenChange={setAdjustOpen}
            user={user}
            onSuccess={() => {
              reloadUser();
              setRechargeKey((k) => k + 1);
            }}
          />
          <UserRechargeSection key={rechargeKey} userId={userId} />
          <UserUsageSection userId={userId} />
          <UserDailyStatsSection userId={userId} />
        </>
      ) : null}
    </div>
  );
}
