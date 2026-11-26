'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

interface AuthLegalNoticeProps {
  mode: 'login' | 'register';
}

export function AuthLegalNotice({ mode }: AuthLegalNoticeProps) {
  const t = useTranslations('authOtp');

  return (
    <p className="mt-4 text-center text-xs text-muted-foreground leading-5">
      {mode === 'login' ? t('legalLoginPrefix') : t('legalRegisterPrefix')}
      <Link href="/terms" target="_blank" rel="noreferrer" className="text-primary hover:underline">
        {t('termsLink')}
      </Link>
      {t('legalAnd')}
      <Link href="/privacy" target="_blank" rel="noreferrer" className="text-primary hover:underline">
        {t('privacyLink')}
      </Link>
      {t('legalSuffix')}
    </p>
  );
}
