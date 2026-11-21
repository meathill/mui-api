'use client';

import { GithubLogo } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { routing } from '@/i18n/routing';
import { signIn } from '@/lib/auth-client';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

type Provider = 'github' | 'google';

export function SocialLoginButtons() {
  const t = useTranslations('login');
  const te = useTranslations('errors');
  const locale = useLocale();
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  const [error, setError] = useState('');

  // OAuth 回调 302 的落地页直接带上 locale 前缀，避免 next-intl middleware 再 307 一跳（issue #22）。
  // callbackURL 是 better-auth 参数而非 next-intl 导航，需按 localePrefix: 'as-needed' 自己拼。
  const dashboardPath =
    locale === routing.defaultLocale && routing.localePrefix === 'as-needed' ? '/app' : `/${locale}/app`;

  async function handleSocialLogin(provider: Provider) {
    setError('');
    setLoadingProvider(provider);
    const result = await signIn.social({
      provider,
      callbackURL: dashboardPath,
    });
    if (result.error) {
      setError(result.error.message || te('loginFailedRetry'));
      setLoadingProvider(null);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full"
        disabled={loadingProvider !== null}
        onClick={() => handleSocialLogin('github')}
      >
        <GithubLogo className="size-4" />
        {loadingProvider === 'github' ? t('redirecting') : t('githubLogin')}
      </Button>
      <Button
        variant="outline"
        className="w-full"
        disabled={loadingProvider !== null}
        onClick={() => handleSocialLogin('google')}
      >
        <GoogleIcon className="size-4" />
        {loadingProvider === 'google' ? t('redirecting') : t('googleLogin')}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
