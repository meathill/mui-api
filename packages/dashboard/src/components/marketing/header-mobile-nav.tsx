'use client';

import { List } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetHeader, SheetPopup, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Link } from '@/i18n/navigation';
import { COMPARE, GATEWAYS, PRODUCTS, type NavLink } from './header-nav';

/**
 * 移动端页头抽屉导航（issue #19）：md 以下隐藏桌面下拉导航，
 * 由汉堡按钮 + 左侧 Sheet 承载全部入口；登录 CTA 不进抽屉，常驻页头右侧。
 * 链接保持纯 <a> 语义（不用 SheetClose 包装，避免被强加 role=button），点击后手动收起抽屉。
 */
export function HeaderMobileNav() {
  const t = useTranslations('header');
  const [isOpen, setIsOpen] = useState(false);

  const quickLinks: NavLink[] = [
    { href: '/pricing', labelKey: 'pricing', fallback: 'Pricing' },
    { href: '/mcp', labelKey: 'mcp', fallback: 'MCP' },
    { href: '/blog', labelKey: 'blog', fallback: 'Blog' },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" aria-label={t('menu')} className="-ml-2 md:hidden" />}>
        <List />
      </SheetTrigger>
      <SheetPopup side="left" className="w-80 gap-0">
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle className="text-base">{t.has('products') ? t('products') : 'Products'}</SheetTitle>
        </SheetHeader>
        <nav className="flex-1 space-y-5 overflow-y-auto p-4">
          <NavGroup items={PRODUCTS} onNavigate={close} />
          <NavGroup items={GATEWAYS} onNavigate={close} />
          <NavGroup items={COMPARE} onNavigate={close} />
          <div className="space-y-1 border-t border-border pt-4">
            {quickLinks.map((item) => (
              <DrawerLink key={item.href} href={item.href} onNavigate={close}>
                {t(item.labelKey)}
              </DrawerLink>
            ))}
          </div>
        </nav>
      </SheetPopup>
    </Sheet>
  );

  function close() {
    setIsOpen(false);
  }
}

function NavGroup({ items, onNavigate }: { items: NavLink[]; onNavigate: () => void }) {
  const t = useTranslations('header');
  return (
    <div className="space-y-1">
      {items.map((item) => (
        <DrawerLink key={item.href} href={item.href} onNavigate={onNavigate}>
          {t.has(item.labelKey) ? t(item.labelKey) : item.fallback}
        </DrawerLink>
      ))}
    </div>
  );
}

function DrawerLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href as never}
      onClick={onNavigate}
      className="block rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
    >
      {children}
    </Link>
  );
}
