// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TermsConsentDialog } from './terms-consent-dialog';

const refresh = vi.fn();
const signOut = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/auth-client', () => ({
  signOut: (...args: unknown[]) => signOut(...args),
}));

function renderDialog(needsReconsent = true) {
  return render(<TermsConsentDialog needsReconsent={needsReconsent} />);
}

function stubFetch(ok: boolean, json: unknown = { ok: true }) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, json: async () => json }));
}

describe('TermsConsentDialog（条款确认弹窗，issue #22 去 GET 化）', () => {
  beforeEach(() => {
    refresh.mockClear();
    signOut.mockClear();
    vi.unstubAllGlobals();
  });

  it('needsReconsent=true 时初始弹出，展示协议链接与确认按钮', () => {
    renderDialog(true);

    expect(screen.getByText('请阅读并同意协议')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '使用协议' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: '隐私政策' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('button', { name: '同意并继续' })).toBeDisabled();
  });

  it('needsReconsent=false 时不弹出', () => {
    renderDialog(false);

    expect(screen.queryByText('请阅读并同意协议')).not.toBeInTheDocument();
  });

  it('未勾选时「同意并继续」禁用，点击不触发请求', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    renderDialog(true);

    const agreeButton = screen.getByRole('button', { name: '同意并继续' });
    expect(agreeButton).toBeDisabled();
    await user.click(agreeButton);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('勾选并同意后 POST 成功，关闭弹窗并 router.refresh', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchSpy);
    renderDialog(true);

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '同意并继续' }));

    await waitFor(() => {
      expect(screen.queryByText('请阅读并同意协议')).not.toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalledExactlyOnceWith('/api/user/accept-terms', {
      method: 'POST',
      credentials: 'same-origin',
    });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('POST 失败时保持弹窗并提示重试', async () => {
    const user = userEvent.setup();
    stubFetch(false);
    renderDialog(true);

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: '同意并继续' }));

    expect(await screen.findByText('提交失败，请重试')).toBeInTheDocument();
    expect(screen.getByText('请阅读并同意协议')).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('拒绝并退出时调用 signOut 并跳转登录页', async () => {
    const user = userEvent.setup();
    const originalLocation = window.location;
    const hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...originalLocation,
        set href(value: string) {
          hrefSetter(value);
        },
      },
    });
    try {
      renderDialog(true);

      await user.click(screen.getByRole('button', { name: '拒绝并退出' }));

      expect(signOut).toHaveBeenCalledOnce();
      expect(hrefSetter).toHaveBeenCalledWith('/login');
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    }
  });
});
