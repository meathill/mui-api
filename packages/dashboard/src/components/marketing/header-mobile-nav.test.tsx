// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import zhMessages from '../../../messages/zh.json';
import { HeaderMobileNav } from './header-mobile-nav';
import { COMPARE, GATEWAYS, PRODUCTS } from './header-nav';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const headerCopy = zhMessages.header as Record<string, string>;

function renderMobileNav(): ReturnType<typeof render> {
  return render(
    <NextIntlClientProvider locale="zh" messages={zhMessages}>
      <HeaderMobileNav />
    </NextIntlClientProvider>,
  );
}

/** issue #19：移动端抽屉导航覆盖桌面导航全部入口 */
describe('HeaderMobileNav', () => {
  it('渲染带本地化 aria-label 的汉堡按钮', () => {
    renderMobileNav();
    expect(screen.getByRole('button', { name: '菜单' })).toBeInTheDocument();
  });

  it('打开抽屉后展示产品/网关/对比与快捷入口', async () => {
    const user = userEvent.setup();
    renderMobileNav();

    await user.click(screen.getByRole('button', { name: '菜单' }));

    const drawer = screen.getByRole('dialog');
    expect(drawer).toBeInTheDocument();

    for (const item of [...PRODUCTS, ...GATEWAYS, ...COMPARE]) {
      expect(drawer).toHaveTextContent(headerCopy[item.labelKey] ?? item.fallback);
    }
    // 快捷入口：价格 / MCP / 博客
    expect(drawer).toHaveTextContent('价格');
    expect(drawer).toHaveTextContent('MCP');
    expect(drawer).toHaveTextContent('博客');
  });

  it('抽屉内链接为真实锚点且点击后关闭抽屉', async () => {
    const user = userEvent.setup();
    renderMobileNav();

    await user.click(screen.getByRole('button', { name: '菜单' }));

    const drawer = screen.getByRole('dialog');
    const pricingLink = within(drawer).getByRole('link', { name: '价格' });
    expect(pricingLink).toHaveAttribute('href', '/pricing');

    await user.click(pricingLink);
    // SheetClose 包装：点击后抽屉收起
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
