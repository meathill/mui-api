'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';

type AuthState = 'authed' | 'guest';

/**
 * 营销页 header 右侧的"登录/Dashboard"按钮。
 * 拆成客户端组件后 marketing layout 可静态化，CF 缓存命中率从约 0% 提升到接近 100%。
 *
 * SSR 按"游客"优先直接渲染登录链接（issue #20）：真实 <a> 在 hydration 完成前即可点击，
 * 消除加载占位块造成的首屏 dead click；fetch 确认已登录后再切换为"进入控制台"。
 * 已登录用户会看到登录链接短暂闪现，换取绝大多数游客的即时可点性。
 */
export function HeaderAuthCta() {
  const [state, setState] = useState<AuthState>('guest');
  const t = useTranslations('header');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/user', { signal: controller.signal, credentials: 'same-origin' })
      .then((res) => {
        if (res.ok) {
          setState('authed');
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setState('guest');
        }
      });
    return () => controller.abort();
  }, []);

  const baseClass =
    'inline-flex h-9 min-w-[5.5rem] items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors sm:px-4';

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
