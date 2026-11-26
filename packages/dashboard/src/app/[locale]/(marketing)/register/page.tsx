'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { AuthLegalNotice } from '@/components/auth/auth-legal-notice';
import { EmailOtpForm } from '@/components/auth/email-otp-form';
import { SocialLoginButtons } from '@/components/social-login-buttons';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Link } from '@/i18n/navigation';

export default function RegisterPage() {
  const t = useTranslations('register');

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-6">
      <Card className="w-full max-w-sm p-6">
        <Image
          src="/brand/mui-mark.png"
          alt=""
          width={56}
          height={56}
          className="mx-auto mb-3 rounded-lg border-2 border-[var(--brand-ink)] shadow-[0_3px_0_0_var(--brand-ink)]"
          aria-hidden
          priority
        />
        <h1 className="text-xl font-bold text-center mb-5">{t('title')}</h1>

        <SocialLoginButtons />

        <div className="relative my-4">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
            {t('or')}
          </span>
        </div>

        <EmailOtpForm mode="register" />

        <p className="text-center text-sm text-muted-foreground mt-4">
          {t('hasAccount')}{' '}
          <Link href="/login" className="text-primary hover:underline">
            {t('login')}
          </Link>
        </p>
        <AuthLegalNotice mode="register" />
      </Card>
    </div>
  );
}
