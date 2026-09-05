'use client';

import { formatBalance } from '@muirouter/shared-db/money';
import { ChartBar, CreditCard, Gift, Key, Wallet } from '@phosphor-icons/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { type FreeQuotaStatus, type TopUpSessionResult, userApi } from '@/lib/api';
import { trackBeginCheckout, trackPurchase } from '@/lib/analytics';
import { TOP_UP_AMOUNTS } from '@/lib/top-up';

interface TopUpNotice {
  description: string;
  title: string;
  variant: 'error' | 'info' | 'success';
}

interface HomeData {
  balance: number;
  keyCount: number;
  freeQuota: FreeQuotaStatus | null;
}

const EMPTY_HOME_DATA: HomeData = { balance: 0, keyCount: 0, freeQuota: null };

export default function DashboardHome() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [topUpAmountLoading, setTopUpAmountLoading] = useState<number | null>(null);
  const [topUpNotice, setTopUpNotice] = useState<TopUpNotice | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHomeData = useCallback(async (): Promise<HomeData> => {
    const [profileRes, keysRes] = await Promise.all([userApi.getProfile(), userApi.getKeys()]);
    return {
      balance: profileRes.user.balance,
      freeQuota: profileRes.user.freeQuota ?? null,
      keyCount: keysRes.keys.filter((k) => k.isActive).length,
    };
  }, []);
  const {
    data: { balance, keyCount, freeQuota },
    loading,
    error,
    setData,
  } = useAsyncResource(fetchHomeData, EMPTY_HOME_DATA);

  useEffect(() => {
    const topUp = searchParams.get('topUp');
    const sessionId = searchParams.get('session_id');

    if (topUp === 'cancelled') {
      setTopUpNotice({
        title: t('topUp.cancelledTitle'),
        description: t('topUp.cancelledDesc'),
        variant: 'info',
      });
      clearTopUpQuery(router, pathname);
      return;
    }

    if (topUp !== 'success' || !sessionId) {
      return;
    }

    const checkoutSessionId = sessionId;
    let disposed = false;

    async function handleReturnedCheckout() {
      await pollTopUpSession(checkoutSessionId, disposed);
    }

    handleReturnedCheckout();

    return () => {
      disposed = true;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [pathname, router, searchParams, t, pollTopUpSession]);

  function scheduleTopUpPoll(sessionId: string, disposed: boolean) {
    if (disposed) {
      return;
    }

    pollTimerRef.current = setTimeout(() => {
      void pollTopUpSession(sessionId, disposed);
    }, 2000);
  }

  function setProcessingNotice() {
    setTopUpNotice({
      title: t('topUp.processingTitle'),
      description: t('topUp.processingDesc'),
      variant: 'info',
    });
  }

  function setSuccessNotice(result: TopUpSessionResult) {
    setTopUpNotice({
      title: t('topUp.successTitle'),
      description: t('topUp.successDesc', {
        amount: formatBalance(result.amount),
        balance: formatBalance(result.balanceAfter ?? 0),
      }),
      variant: 'success',
    });
  }

  function setFailedNotice(message?: string) {
    setTopUpNotice({
      title: t('topUp.failedTitle'),
      description: message || t('topUp.failedDesc'),
      variant: 'error',
    });
  }

  async function handleTopUp(amount: number) {
    setTopUpAmountLoading(amount);
    setTopUpNotice(null);

    try {
      const result = await userApi.createTopUpCheckout(amount, locale);
      trackBeginCheckout(amount);
      window.location.href = result.url;
    } catch (e) {
      setFailedNotice(e instanceof Error ? e.message : te('topUpFailed'));
      setTopUpAmountLoading(null);
    }
  }

  async function pollTopUpSession(sessionId: string, disposed: boolean) {
    try {
      setProcessingNotice();
      const result = await userApi.getTopUpSession(sessionId);
      if (disposed) {
        return;
      }

      if (result.status === 'credited') {
        setData((current) => ({ ...current, balance: result.balanceAfter ?? current.balance }));
        trackPurchase(sessionId, result.amount);
        setSuccessNotice(result);
        setTopUpAmountLoading(null);
        clearTopUpQuery(router, pathname);
        return;
      }

      if (result.status === 'failed') {
        setFailedNotice();
        setTopUpAmountLoading(null);
        clearTopUpQuery(router, pathname);
        return;
      }

      if (result.status === 'cancelled') {
        setTopUpNotice({
          title: t('topUp.cancelledTitle'),
          description: t('topUp.cancelledDesc'),
          variant: 'info',
        });
        setTopUpAmountLoading(null);
        clearTopUpQuery(router, pathname);
        return;
      }

      scheduleTopUpPoll(sessionId, disposed);
    } catch (e) {
      if (disposed) {
        return;
      }

      setFailedNotice(e instanceof Error ? e.message : t('topUp.failedDesc'));
      setTopUpAmountLoading(null);
      clearTopUpQuery(router, pathname);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">{tc('loading')}</p>;
  }

  if (error) {
    return <p className="text-destructive">{error}</p>;
  }

  const hasFreeQuota = freeQuota?.enabled === true && freeQuota.amount > 0;

  return (
    <div>
      <PageHeader eyebrow="Dashboard · Overview" title={t('title')} />

      {topUpNotice && (
        <Alert className="mb-6" variant={topUpNotice.variant}>
          <AlertTitle>{topUpNotice.title}</AlertTitle>
          <AlertDescription>{topUpNotice.description}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
        <Card className="p-6">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Wallet size={18} className="text-primary" weight="duotone" />
            </div>
            <span className="text-sm text-muted-foreground">{t('balance')}</span>
          </div>
          <p className="font-heading text-3xl font-bold tracking-tight">${formatBalance(balance)}</p>
        </Card>

        <Card className="p-6">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Key size={18} className="text-primary" weight="duotone" />
            </div>
            <span className="text-sm text-muted-foreground">{t('activeKeys')}</span>
          </div>
          <p className="font-heading text-3xl font-bold tracking-tight">{keyCount}</p>
        </Card>

        <Card className="p-6">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <ChartBar size={18} className="text-primary" weight="duotone" />
            </div>
            <span className="text-sm text-muted-foreground">{t('apiStatus')}</span>
          </div>
          <p className="text-lg font-medium text-[var(--success)]">{t('running')}</p>
        </Card>

        {hasFreeQuota && (
          <Card className="p-6">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand-fluff)]">
                <Gift size={18} className="text-[var(--brand-yellow-deep)]" weight="duotone" />
              </div>
              <span className="text-sm text-muted-foreground">{t('freeQuota')}</span>
            </div>
            <p className="font-heading text-3xl font-bold tracking-tight">${formatBalance(freeQuota.remaining)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('freeQuotaHint', {
                amount: formatBalance(freeQuota.amount),
                count: freeQuota.modelIds.length,
              })}
            </p>
          </Card>
        )}
      </div>

      <Card className="mt-8 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <CreditCard size={18} className="text-primary" weight="duotone" />
              </div>
              <div>
                <h3 className="font-semibold">{t('topUp.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('topUp.description')}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{t('topUp.hint')}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {TOP_UP_AMOUNTS.map((amount) => (
              <Button
                key={amount}
                onClick={() => handleTopUp(amount)}
                disabled={topUpAmountLoading !== null}
                size="lg"
                variant={amount === 20 ? 'press' : 'outline'}
              >
                {topUpAmountLoading === amount ? t('topUp.redirecting') : t('topUp.button', { amount })}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="mt-8 p-6">
        <h3 className="mb-3 font-semibold">{t('quickStart')}</h3>
        <div className="rounded-lg bg-muted p-4 font-mono text-sm leading-relaxed">
          <p className="mb-2 text-muted-foreground">{t('curlComment')}</p>
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

function clearTopUpQuery(router: ReturnType<typeof useRouter>, pathname: string) {
  router.replace(pathname, { scroll: false });
}
