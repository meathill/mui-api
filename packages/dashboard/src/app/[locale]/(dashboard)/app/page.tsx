'use client';

import { formatBalance } from '@muirouter/shared-db/money';
import { ChartBar, CreditCard, Gift, Key, Plus, Wallet } from '@phosphor-icons/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { TopUpDialog } from '@/components/top-up-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { setCustomTag, trackEvent } from '@/lib/analytics';
import { type FreeQuotaStatus, type TopUpSessionResult, userApi } from '@/lib/api';
import { TOP_UP_AMOUNTS } from '@/lib/top-up';
import { cn } from '@/lib/utils';

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

// 与真实概览卡同构的骨架占位：加载期间替代原先一行「加载中...」文本（issue #22）
function DashboardCardSkeleton() {
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-9 w-28" />
    </Card>
  );
}

export default function DashboardHome() {
  const t = useTranslations('dashboard');
  const te = useTranslations('errors');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [topUpAmountLoading, setTopUpAmountLoading] = useState<number | null>(null);
  const [topUpNotice, setTopUpNotice] = useState<TopUpNotice | null>(null);
  const [isTopUpDialogOpen, setTopUpDialogOpen] = useState(false);
  const [isTopUpCardHighlighted, setTopUpCardHighlighted] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      trackEvent('topup_cancelled');
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

    // 已回到成功落地页，与 topup_completed（确认到账）分开度量，能看出 webhook 延迟或提前离开的比例
    trackEvent('topup_returned_success');

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
      trackEvent('topup_checkout_started', { amount });
      setCustomTag('topup_amount', String(amount));
      window.location.href = result.url;
    } catch (e) {
      trackEvent('topup_checkout_failed', { amount });
      setFailedNotice(e instanceof Error ? e.message : te('topUpFailed'));
      setTopUpAmountLoading(null);
    }
  }

  /** 余额卡整体可点：滚到充值卡并短暂高亮，承接"点余额想充值"的直觉（issue #23 dead click） */
  function handleBalanceCardClick() {
    trackEvent('topup_balance_card_clicked', { balance });
    document.getElementById('topup-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    setTopUpCardHighlighted(true);
    highlightTimerRef.current = setTimeout(() => setTopUpCardHighlighted(false), 1500);
  }

  /** 「充值」按钮：弹金额选择框，是比滚动更直接的充值入口 */
  function handleAddCreditClick() {
    trackEvent('topup_add_credit_clicked', { balance });
    setTopUpDialogOpen(true);
  }

  async function pollTopUpSession(sessionId: string, disposed: boolean) {
    try {
      setProcessingNotice();
      const result = await userApi.getTopUpSession(sessionId);
      if (disposed) {
        return;
      }

      if (result.status === 'credited') {
        trackEvent('topup_completed', { amount: result.amount });
        setData((current) => ({ ...current, balance: result.balanceAfter ?? current.balance }));
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
        trackEvent('topup_cancelled');
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
    return (
      <div aria-busy="true" aria-live="polite">
        <PageHeader eyebrow="Dashboard · Overview" title={t('title')} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <DashboardCardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
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
        {/* select-none：余额数字易被当作可点区域误选（issue #23 dead click）；整卡可点跳充值区 */}
        <Card className="group cursor-pointer select-none p-6 transition-colors hover:border-primary/50 group-focus-visible:ring-2 group-focus-visible:ring-primary/50">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Wallet size={18} className="text-primary" weight="duotone" />
            </div>
            <span className="text-sm text-muted-foreground">{t('balance')}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="font-heading text-3xl font-bold tracking-tight">${formatBalance(balance)}</p>
            <Button
              size="sm"
              variant="outline"
              className="relative z-10"
              onClick={handleAddCreditClick}
              disabled={topUpAmountLoading !== null}
            >
              <Plus size={14} />
              {t('topUp.addCredit')}
            </Button>
          </div>
          <button
            type="button"
            className="absolute inset-0"
            aria-label={t('topUp.balanceCardAria')}
            onClick={handleBalanceCardClick}
          />
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

      <Card id="topup-card" className={cn('mt-8 p-6', isTopUpCardHighlighted && 'ring-2 ring-primary/40')}>
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

      <TopUpDialog
        open={isTopUpDialogOpen}
        pendingAmount={topUpAmountLoading}
        onOpenChange={setTopUpDialogOpen}
        onTopUp={handleTopUp}
      />
    </div>
  );
}

function clearTopUpQuery(router: ReturnType<typeof useRouter>, pathname: string) {
  router.replace(pathname, { scroll: false });
}
