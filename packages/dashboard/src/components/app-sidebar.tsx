'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, Key, ChartBar, Terminal, UsersThree, Cube, ChartLineUp, GearSix, SignOut } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'fill' }>;
}

const USER_NAV: NavItem[] = [
  { href: '/app', label: '数据概览', icon: House },
  { href: '/keys', label: 'API Key', icon: Key },
  { href: '/usage', label: '消费明细', icon: ChartBar },
  { href: '/playground', label: 'API Demo', icon: Terminal },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin/users', label: '用户管理', icon: UsersThree },
  { href: '/admin/models', label: '模型管理', icon: Cube },
  { href: '/admin/usage', label: '用量统计', icon: ChartLineUp },
  { href: '/admin/settings', label: '系统设置', icon: GearSix },
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

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  async function handleSignOut() {
    await signOut();
    window.location.href = '/login';
  }

  return (
    <aside className="w-56 border-r border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold text-foreground">MUI Router</h1>
        <p className="text-xs text-muted-foreground">控制台</p>
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
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <IconComponent size={18} weight={active ? 'fill' : 'regular'} />
              {item.label}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <Separator className="my-2" />
            <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">管理</p>
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
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut} title="退出登录">
            <SignOut size={16} />
          </Button>
        </div>
      </div>
    </aside>
  );
}
