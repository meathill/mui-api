// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import esMessages from '../../../../../messages/es.json';
import zhMessages from '../../../../../messages/zh.json';
import RegisterPage from './page';

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    emailOtp: { sendVerificationOtp: vi.fn() },
    signIn: { emailOtp: vi.fn() },
  },
  signIn: { social: vi.fn() },
}));

function renderRegisterPage(locale: 'zh' | 'es', messages: Record<string, unknown>): ReturnType<typeof render> {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <RegisterPage />
    </NextIntlClientProvider>,
  );
}

describe('RegisterPage (语义与可访问性)', () => {
  it('在中文语言环境下主标题使用语义 h1 且内容正确', () => {
    renderRegisterPage('zh', zhMessages);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('注册');
    expect(heading).toHaveClass('text-xl font-bold text-center mb-5');

    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('在西班牙语语言环境下主标题使用语义 h1 且内容正确', () => {
    renderRegisterPage('es', esMessages);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('Registrarse');
    expect(heading).toHaveClass('text-xl font-bold text-center mb-5');

    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('底部展示使用协议与隐私政策链接', () => {
    renderRegisterPage('zh', zhMessages);

    expect(screen.getByRole('link', { name: '《使用协议》' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: '《隐私政策》' })).toHaveAttribute('href', '/privacy');
  });
});
