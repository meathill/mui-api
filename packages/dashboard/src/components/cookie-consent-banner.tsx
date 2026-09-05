'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { denyAnalyticsConsent, getAnalyticsConsent, grantAnalyticsConsent } from '@/lib/analytics';

/**
 * GA4 Consent Mode v2 横幅：用户未表态时才展示。
 * 同意后 analytics_storage granted；拒绝后保持 denied（gtag 只发 cookieless ping）。
 */
export function CookieConsentBanner() {
  const t = useTranslations('consent');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getAnalyticsConsent() === null) setVisible(true);
  }, []);

  function handleAccept() {
    grantAnalyticsConsent();
    setVisible(false);
  }

  function handleDecline() {
    denyAnalyticsConsent();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('title')}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-2xl rounded-xl border border-border bg-card p-4 shadow-lg"
    >
      <p className="text-sm font-medium">{t('title')}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t('message')}</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleDecline}>
          {t('decline')}
        </Button>
        <Button size="sm" onClick={handleAccept}>
          {t('accept')}
        </Button>
      </div>
    </div>
  );
}
