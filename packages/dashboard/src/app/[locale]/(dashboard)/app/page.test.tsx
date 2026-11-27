// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import zhMessages from '../../../../../messages/zh.json';
import DashboardHome from './page';
import { TOP_UP_BALANCE_MAX_POLLS, TOP_UP_POLL_INTERVAL_MS } from './use-top-up-return';

const replaceMock = vi.fn();
const stableRouter = { replace: replaceMock };
let currentSearchParams = new URLSearchParams();

const trackEventMock = vi.fn();
const setCustomTagMock = vi.fn();
const getProfileMock = vi.fn();
const getKeysMock = vi.fn();
const getTopUpSessionMock = vi.fn();
const createTopUpCheckoutMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/zh/app',
  useRouter: () => stableRouter,
  useSearchParams: () => currentSearchParams,
}));

vi.mock('@/lib/analytics', () => ({
  setCustomTag: (...args: unknown[]) => setCustomTagMock(...args),
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
}));

vi.mock('@/lib/api', () => ({
  userApi: {
    createTopUpCheckout: (...args: unknown[]) => createTopUpCheckoutMock(...args),
    getKeys: (...args: unknown[]) => getKeysMock(...args),
    getProfile: (...args: unknown[]) => getProfileMock(...args),
    getTopUpSession: (...args: unknown[]) => getTopUpSessionMock(...args),
  },
}));

function makeProfileResponse(balance: number) {
  return {
    user: {
      balance,
      concurrency: 0,
      createdAt: '2026-11-25T00:00:00Z',
      email: 'user@example.com',
      freeQuota: null,
      isSuspended: false,
      maxConcurrency: 3,
      rateMultiplier: 1,
      userId: 'user-1',
    },
  };
}

function renderDashboardHome(queryString = '') {
  currentSearchParams = new URLSearchParams(queryString);
  return render(
    <NextIntlClientProvider locale="zh" messages={zhMessages}>
      <DashboardHome />
    </NextIntlClientProvider>,
  );
}

async function flushMicrotasks() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe('DashboardHome 充值回跳确认流程（issue #26）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    replaceMock.mockReset();
    trackEventMock.mockReset();
    setCustomTagMock.mockReset();
    getProfileMock.mockReset();
    getKeysMock.mockReset();
    getTopUpSessionMock.mockReset();
    createTopUpCheckoutMock.mockReset();

    getKeysMock.mockResolvedValue({ keys: [{ id: 'k1', keyPrefix: 'sk-gw-1', isActive: true, createdAt: '' }] });
    getProfileMock.mockResolvedValue(makeProfileResponse(5));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('有效 session_id：仅埋点一次 returned，轮询到账后更新余额并清理 query', async () => {
    getTopUpSessionMock
      .mockResolvedValueOnce({
        amount: 20,
        balanceAfter: null,
        paymentStatus: 'paid',
        sessionId: 'cs_live_123',
        status: 'processing',
      })
      .mockResolvedValueOnce({
        amount: 20,
        balanceAfter: 25,
        paymentStatus: 'paid',
        sessionId: 'cs_live_123',
        status: 'credited',
      });

    renderDashboardHome('session_id=cs_live_123&topUp=success');
    await flushMicrotasks();

    expect(screen.getByText('充值处理中')).toBeInTheDocument();
    expect(screen.getByText('$5.00')).toBeInTheDocument();
    expect(getTopUpSessionMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith('topup_returned_success');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TOP_UP_POLL_INTERVAL_MS);
    });

    expect(getTopUpSessionMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText('充值成功')).toBeInTheDocument();
    expect(screen.getByText('已到账 $20.00，当前余额 $25.00。')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
    expect(trackEventMock).toHaveBeenCalledWith('topup_completed', { amount: 20 });
    expect(replaceMock).toHaveBeenCalledExactlyOnceWith('/zh/app', { scroll: false });
  });

  it.each(['{CHECKOUT_SESSION_ID}', '{foo}'])(
    '占位符或无效 session_id（%s）：跳过会话查询与 returned 埋点，直接轮询余额并在到账后提示成功',
    async (sessionId) => {
      getProfileMock
        // useAsyncResource 初次拉取与 pollBalance(1) 基线
        .mockResolvedValueOnce(makeProfileResponse(5))
        .mockResolvedValueOnce(makeProfileResponse(5))
        // pollBalance(2) 检测到余额增加
        .mockResolvedValueOnce(makeProfileResponse(25));

      renderDashboardHome(`session_id=${encodeURIComponent(sessionId)}&topUp=success`);
      await flushMicrotasks();

      expect(getTopUpSessionMock).not.toHaveBeenCalled();
      expect(trackEventMock).not.toHaveBeenCalledWith('topup_returned_success');
      expect(screen.getByText('充值处理中')).toBeInTheDocument();
      expect(screen.getByText('$5.00')).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(TOP_UP_POLL_INTERVAL_MS);
      });

      expect(screen.getByText('$25.00')).toBeInTheDocument();
      expect(screen.getByText('充值成功')).toBeInTheDocument();
      expect(screen.getByText('已到账 $20.00，当前余额 $25.00。')).toBeInTheDocument();
      expect(replaceMock).toHaveBeenCalledExactlyOnceWith('/zh/app', { scroll: false });
    },
  );

  it('占位符回跳但余额持续未变动：达到最大轮询次数后停止并清理 query 且不报错误', async () => {
    renderDashboardHome(`session_id=${encodeURIComponent('{CHECKOUT_SESSION_ID}')}&topUp=success`);
    await flushMicrotasks();

    // 初次拉取 + pollBalance(1) 共 2 次
    expect(getProfileMock).toHaveBeenCalledTimes(2);

    for (let i = 1; i < TOP_UP_BALANCE_MAX_POLLS; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(TOP_UP_POLL_INTERVAL_MS);
      });
    }

    expect(getProfileMock).toHaveBeenCalledTimes(1 + TOP_UP_BALANCE_MAX_POLLS);
    expect(screen.getByText('充值处理中')).toBeInTheDocument();
    expect(screen.queryByText('充值处理失败')).not.toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledExactlyOnceWith('/zh/app', { scroll: false });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TOP_UP_POLL_INTERVAL_MS * 2);
    });
    expect(getProfileMock).toHaveBeenCalledTimes(1 + TOP_UP_BALANCE_MAX_POLLS);
  });

  it('topUp=cancelled：触发取消埋点、展示取消提示并立即清理 query', async () => {
    renderDashboardHome('topUp=cancelled');
    await flushMicrotasks();

    expect(trackEventMock).toHaveBeenCalledExactlyOnceWith('topup_cancelled');
    expect(screen.getByText('支付已取消')).toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledExactlyOnceWith('/zh/app', { scroll: false });
  });

  it('轮询过程中组件卸载：清理定时器，不再发起后续请求', async () => {
    getTopUpSessionMock.mockResolvedValue({
      amount: 20,
      balanceAfter: null,
      paymentStatus: 'paid',
      sessionId: 'cs_live_123',
      status: 'processing',
    });

    const { unmount } = renderDashboardHome('session_id=cs_live_123&topUp=success');
    await flushMicrotasks();
    expect(getTopUpSessionMock).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TOP_UP_POLL_INTERVAL_MS * 3);
    });

    expect(getTopUpSessionMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
