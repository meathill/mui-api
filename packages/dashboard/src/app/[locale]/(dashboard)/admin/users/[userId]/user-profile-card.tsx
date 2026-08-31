'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { UserInfo } from '@/lib/api';

export interface UserProfileCardProps {
  user: UserInfo;
  onAdjustBalance?: () => void;
}

export function UserProfileCard({ user, onAdjustBalance }: UserProfileCardProps) {
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

  const tDetail = useTranslations('adminUserDetail');

  return (
    <Card className="p-4 mb-4">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-xs text-muted-foreground">{field.label}</dt>
            <dd className="mt-1 text-sm font-medium">{field.value}</dd>
          </div>
        ))}
      </dl>
      {onAdjustBalance && (
        <div className="mt-4 flex justify-end">
          <Button size="sm" variant="outline" onClick={onAdjustBalance}>
            {tDetail('adjustBalance')}
          </Button>
        </div>
      )}
    </Card>
  );
}
