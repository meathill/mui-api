import { defaultLocale } from '@/i18n/config';

export const SITE_URL = 'https://muirouter.com';
export const MARKETING_OG_IMAGE_ALT = 'MUI Router - One Key, All AI Models';
export const MARKETING_OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export function getMarketingOgImage(locale: string) {
  const pathname = locale === defaultLocale ? '/og-image' : `/${locale}/og-image`;

  return {
    url: `${SITE_URL}${pathname}`,
    width: MARKETING_OG_IMAGE_SIZE.width,
    height: MARKETING_OG_IMAGE_SIZE.height,
    alt: MARKETING_OG_IMAGE_ALT,
  };
}
