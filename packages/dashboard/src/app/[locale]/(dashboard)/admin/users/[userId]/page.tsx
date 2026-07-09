'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Link } from '@/i18n/navigation';
import { api, type UserInfo } from '@/lib/api';
import { UserDailyStatsSection } from './user-daily-stats-section';
import { UserProfileCard } from './user-profile-card';
import { UserRechargeSection } from './user-recharge-section';
import { UserUsageSection } from './user-usage-section';

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const t = useTranslations('adminUserDetail');
  const te = useTranslations('errors');
  const tc = useTranslations('common');

  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getUser({ userId });
      setUser(data.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : te('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [userId, te]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

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
        <p className="text-muted-foreground">{tc('loading')}</p>
      ) : user ? (
        <>
          <UserProfileCard user={user} />
          <UserRechargeSection userId={userId} />
          <UserUsageSection userId={userId} />
          <UserDailyStatsSection userId={userId} />
        </>
      ) : null}
    </div>
  );
}
