'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { userApi } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Wallet, Key, ChartBar } from '@phosphor-icons/react';

export default function DashboardHome() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const [balance, setBalance] = useState<number>(0);
  const [keyCount, setKeyCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [profileRes, keysRes] = await Promise.all([userApi.getProfile(), userApi.getKeys()]);
        setBalance(profileRes.user.balance);
        setKeyCount(keysRes.keys.filter((k) => k.isActive).length);
      } catch (e) {
        setError(e instanceof Error ? e.message : te('loadFailed'));
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [te]);

  if (loading) {
    return <p className="text-muted-foreground">{tc('loading')}</p>;
  }
  if (error) {
    return <p className="text-destructive">{error}</p>;
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">{t('title')}</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet size={18} className="text-primary" weight="duotone" />
            </div>
            <span className="text-sm text-muted-foreground">{t('balance')}</span>
          </div>
          <p className="text-3xl font-bold font-mono">${balance.toFixed(2)}</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Key size={18} className="text-primary" weight="duotone" />
            </div>
            <span className="text-sm text-muted-foreground">{t('activeKeys')}</span>
          </div>
          <p className="text-3xl font-bold font-mono">{keyCount}</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <ChartBar size={18} className="text-primary" weight="duotone" />
            </div>
            <span className="text-sm text-muted-foreground">{t('apiStatus')}</span>
          </div>
          <p className="text-lg font-medium text-green-600">{t('running')}</p>
        </Card>
      </div>

      <Card className="mt-8 p-6">
        <h3 className="font-semibold mb-3">{t('quickStart')}</h3>
        <div className="bg-muted rounded-lg p-4 font-mono text-sm leading-relaxed">
          <p className="text-muted-foreground mb-2">{t('curlComment')}</p>
          <p>curl https://api.muirouter.com/v1/chat/completions \</p>
          <p className="pl-4">-H &quot;Authorization: Bearer YOUR_API_KEY&quot; \</p>
          <p className="pl-4">-H &quot;Content-Type: application/json&quot; \</p>
          <p className="pl-4">
            -d
            &apos;&#123;&quot;model&quot;:&quot;gpt-4o&quot;,&quot;messages&quot;:[&#123;&quot;role&quot;:&quot;user&quot;,&quot;content&quot;:&quot;Hello&quot;&#125;]&#125;&apos;
          </p>
        </div>
      </Card>
    </div>
  );
}
