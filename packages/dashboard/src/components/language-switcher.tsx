'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/config';

const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
  th: 'ไทย',
  ja: '日本語',
};

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.replace(pathname, { locale: e.target.value as Locale });
  }

  return (
    <select
      value={locale}
      onChange={handleChange}
      className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
    >
      {Object.entries(LOCALE_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
