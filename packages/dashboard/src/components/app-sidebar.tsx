'use client';

import {
  ChartBar,
  ChartLineUp,
  ChartPie,
  Cube,
  GearSix,
  House,
  Key,
  Receipt,
  SignOut,
  Terminal,
  UsersThree,
} from '@phosphor-icons/react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Link, usePathname } from '@/i18n/navigation';
import { signOut } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'fill' }>;
}

const USER_NAV: NavItem[] = [
  { href: '/app', labelKey: 'overview', icon: House },
  { href: '/keys', labelKey: 'apiKey', icon: Key },
  { href: '/usage', labelKey: 'usage', icon: ChartBar },
  { href: '/playground', labelKey: 'playground', icon: Terminal },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin/users', labelKey: 'userManagement', icon: UsersThree },
  { href: '/admin/recharge', labelKey: 'rechargeLogs', icon: Receipt },
  { href: '/admin/models', labelKey: 'modelManagement', icon: Cube },
  { href: '/admin/usage', labelKey: 'usageStats', icon: ChartLineUp },
  { href: '/admin/statistics', labelKey: 'statistics', icon: ChartPie },
  { href: '/admin/settings', labelKey: 'settings', icon: GearSix },
];

interface AppSidebarProps {
  user: {
    id: string;
    email: string;
    name: string;
  };
  isAdmin: boolean;
}

export function AppSidebar({ user, isAdmin }: AppSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('sidebar');

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleSignOut() {
    await signOut();
    window.location.href = '/login';
  }

  return (
    <aside className="w-56 border-r border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Image
            src="/brand/mui-mark.png"
            alt=""
            width={28}
            height={28}
            className="shrink-0 rounded-md border border-[var(--brand-rule-strong)]"
            aria-hidden
          />
          <h1 className="font-heading text-lg font-bold text-foreground">MuiRouter</h1>
        </div>
        <p className="eyebrow mt-1.5">{t('console')}</p>
      </div>

      <nav className="flex-1 p-2 overflow-auto">
        {USER_NAV.map((item) => {
          const active = isActive(item.href);
          const IconComponent = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-1 transition-colors',
                active
                  ? 'bg-[var(--brand-fluff)] text-[var(--brand-yellow-deep)] font-semibold'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <IconComponent size={18} weight={active ? 'fill' : 'regular'} />
              {t(item.labelKey)}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <Separator className="my-2" />
            <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('admin')}</p>
            {ADMIN_NAV.map((item) => {
              const active = isActive(item.href);
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-1 transition-colors',
                    active
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <IconComponent size={18} weight={active ? 'fill' : 'regular'} />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="mb-2 flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut} title={t('signOut')}>
            <SignOut size={16} />
          </Button>
        </div>
      </div>
    </aside>
  );
}
