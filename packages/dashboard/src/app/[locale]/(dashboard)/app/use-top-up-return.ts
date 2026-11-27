'use client';

import { formatBalance, fromCents, toCents } from '@muirouter/shared-db/money';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import { userApi } from '@/lib/api';
import { isInvalidTopUpSessionId } from '@/lib/top-up';

export const TOP_UP_POLL_INTERVAL_MS = 2_000;
export const TOP_UP_SESSION_MAX_POLLS = 30;
export const TOP_UP_BALANCE_MAX_POLLS = 6;

export interface TopUpNotice {
  description: string;
  title: string;
  variant: 'error' | 'info' | 'success';
}

interface UseTopUpReturnOptions {
  onBalanceUpdate: (balance: number) => void;
  onTopUpSettled: () => void;
}

function clearTopUpQuery(router: ReturnType<typeof useRouter>, pathname: string) {
  router.replace(pathname, { scroll: false });
}

export function useTopUpReturn({ onBalanceUpdate, onTopUpSettled }: UseTopUpReturnOptions) {
  const t = useTranslations('dashboard');
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const topUp = searchParams.get('topUp');
  const sessionId = searchParams.get('session_id');
  const [topUpNotice, setTopUpNotice] = useState<TopUpNotice | null>(null);

  const tRef = useRef(t);
  tRef.current = t;
  const routerRef = useRef(router);
  routerRef.current = router;
  const onBalanceUpdateRef = useRef(onBalanceUpdate);
  onBalanceUpdateRef.current = onBalanceUpdate;
  const onTopUpSettledRef = useRef(onTopUpSettled);
  onTopUpSettledRef.current = onTopUpSettled;

  const setFailedNotice = useCallback((message?: string) => {
    setTopUpNotice({
      title: tRef.current('topUp.failedTitle'),
      description: message || tRef.current('topUp.failedDesc'),
      variant: 'error',
    });
  }, []);

  useEffect(() => {
    function showProcessingNotice() {
      setTopUpNotice({
        title: tRef.current('topUp.processingTitle'),
        description: tRef.current('topUp.processingDesc'),
        variant: 'info',
      });
    }

    function showCancelledNotice() {
      setTopUpNotice({
        title: tRef.current('topUp.cancelledTitle'),
        description: tRef.current('topUp.cancelledDesc'),
        variant: 'info',
      });
    }

    function showSuccessNotice(amount: number, balanceAfter: number) {
      setTopUpNotice({
        title: tRef.current('topUp.successTitle'),
        description: tRef.current('topUp.successDesc', {
          amount: formatBalance(amount),
          balance: formatBalance(balanceAfter),
        }),
        variant: 'success',
      });
    }

    if (topUp === 'cancelled') {
      trackEvent('topup_cancelled');
      showCancelledNotice();
      clearTopUpQuery(routerRef.current, pathname);
      return;
    }

    if (topUp !== 'success') {
      return;
    }

    let isDisposed = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    function finishPolling() {
      onTopUpSettledRef.current();
      clearTopUpQuery(routerRef.current, pathname);
    }

    // 占位符或无效 session_id 防御：跳过会话接口与 returned 埋点，直接展示处理中并轮询余额
    if (isInvalidTopUpSessionId(sessionId)) {
      let baselineBalance: number | null = null;
      showProcessingNotice();

      async function pollBalance(attempt: number) {
        try {
          const profileRes = await userApi.getProfile();
          if (isDisposed) {
            return;
          }

          const latestBalance = profileRes.user.balance;
          onBalanceUpdateRef.current(latestBalance);

          if (baselineBalance === null) {
            baselineBalance = latestBalance;
          } else if (toCents(latestBalance) > toCents(baselineBalance)) {
            const creditedAmount = fromCents(toCents(latestBalance) - toCents(baselineBalance));
            showSuccessNotice(creditedAmount, latestBalance);
            finishPolling();
            return;
          }
        } catch {
          if (isDisposed) {
            return;
          }
        }

        if (attempt >= TOP_UP_BALANCE_MAX_POLLS) {
          finishPolling();
          return;
        }

        pollTimer = setTimeout(() => {
          void pollBalance(attempt + 1);
        }, TOP_UP_POLL_INTERVAL_MS);
      }

      void pollBalance(1);

      return () => {
        isDisposed = true;
        if (pollTimer) {
          clearTimeout(pollTimer);
          pollTimer = null;
        }
      };
    }

    const checkoutSessionId = sessionId as string;

    // 已回到成功落地页，与 topup_completed（确认到账）分开度量，能看出 webhook 延迟或提前离开的比例
    trackEvent('topup_returned_success');
    showProcessingNotice();

    async function pollSession(attempt: number) {
      try {
        const result = await userApi.getTopUpSession(checkoutSessionId);
        if (isDisposed) {
          return;
        }

        if (result.status === 'credited') {
          trackEvent('topup_completed', { amount: result.amount });
          if (result.balanceAfter !== null) {
            onBalanceUpdateRef.current(result.balanceAfter);
          }
          showSuccessNotice(result.amount, result.balanceAfter ?? 0);
          finishPolling();
          return;
        }

        if (result.status === 'failed') {
          setFailedNotice();
          finishPolling();
          return;
        }

        if (result.status === 'cancelled') {
          trackEvent('topup_cancelled');
          showCancelledNotice();
          finishPolling();
          return;
        }

        if (attempt >= TOP_UP_SESSION_MAX_POLLS) {
          finishPolling();
          return;
        }

        pollTimer = setTimeout(() => {
          void pollSession(attempt + 1);
        }, TOP_UP_POLL_INTERVAL_MS);
      } catch (error) {
        if (isDisposed) {
          return;
        }

        setFailedNotice(error instanceof Error ? error.message : tRef.current('topUp.failedDesc'));
        finishPolling();
      }
    }

    void pollSession(1);

    return () => {
      isDisposed = true;
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    };
  }, [pathname, sessionId, setFailedNotice, topUp]);

  return {
    topUpNotice,
    setTopUpNotice,
    setFailedNotice,
  };
}
