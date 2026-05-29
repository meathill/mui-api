'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

type AuthState = 'loading' | 'authed' | 'guest';

/**
 * 营销页 header 右侧的"登录/Dashboard"按钮。
 * 拆成客户端组件后 marketing layout 可静态化，CF 缓存命中率从约 0% 提升到接近 100%。
 */
export function HeaderAuthCta() {
  const [state, setState] = useState<AuthState>('loading');
  const t = useTranslations('header');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/user', { signal: controller.signal, credentials: 'same-origin' })
      .then((res) => {
        setState(res.ok ? 'authed' : 'guest');
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setState('guest');
        }
      });
    return () => controller.abort();
  }, []);

  const baseClass = 'inline-flex h-9 min-w-[5.5rem] items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors sm:px-4';

  if (state === 'loading') {
    return <div className={`${baseClass} bg-muted/40`} aria-hidden suppressHydrationWarning />;
  }

  if (state === 'authed') {
    return (
      <Link href="/app" className={`${baseClass} bg-primary text-primary-foreground hover:bg-primary/90`}>
        {t('dashboard')}
      </Link>
    );
  }

  return (
    <Link href="/login" className={`${baseClass} text-muted-foreground hover:text-foreground`}>
      {t('signIn')}
    </Link>
  );
}
