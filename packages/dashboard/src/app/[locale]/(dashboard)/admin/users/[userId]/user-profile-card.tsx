'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { UserInfo } from '@/lib/api';

export interface UserProfileCardProps {
  user: UserInfo;
  onAdjustBalance?: () => void;
}

export function UserProfileCard({ user }: UserProfileCardProps) {
  const t = useTranslations('adminUsers');
  const tu = useTranslations('adminUsage');

  const fields: Array<{ label: string; value: ReactNode }> = [
    { label: t('email'), value: user.email },
    { label: tu('userId'), value: user.userId },
    { label: t('colBalance'), value: `$${user.balance.toFixed(4)}` },
    {
      label: t('colRate'),
      value:
        user.rateMultiplier !== 1 ? (
          <Badge variant="outline">{user.rateMultiplier}x</Badge>
        ) : (
          <span className="text-muted-foreground">1x</span>
        ),
    },
    { label: t('colConcurrency'), value: `${user.concurrency}/${user.maxConcurrency}` },
    {
      label: t('colStatus'),
      value: user.isSuspended ? (
        <Badge variant="destructive">{t('suspended')}</Badge>
      ) : (
        <Badge variant="secondary">{t('normal')}</Badge>
      ),
    },
    { label: t('colCreatedAt'), value: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-' },
  ];

  return (
    <Card className="p-5 sm:p-6 mb-4">
      <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-sm text-muted-foreground">{field.label}</dt>
            <dd className="mt-2 text-lg sm:text-xl font-semibold tracking-tight">{field.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
