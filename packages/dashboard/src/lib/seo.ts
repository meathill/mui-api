import type { Metadata } from 'next';
import { defaultLocale, type Locale, locales } from '@/i18n/config';

export const SITE_NAME = 'MuiRouter';
export const SITE_URL = 'https://muirouter.com';
export const MARKETING_OG_IMAGE_ALT = 'MuiRouter - AI API Router for Every LLM';
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

export function getBlogPostOgImage(slug: string, locale: string) {
  return {
    url: `${SITE_URL}${getLocalizedPath(`/blog/${slug}/og-image`, locale)}`,
    width: MARKETING_OG_IMAGE_SIZE.width,
    height: MARKETING_OG_IMAGE_SIZE.height,
    alt: `${SITE_NAME} Blog`,
  };
}

export function getLocalizedPath(href: string, locale: string): string {
  if (locale === defaultLocale) {
    return href;
  }
  // 对根路径要特殊处理：/zh 而不是 /zh/，避免 Next.js 自动 308 重定向
  return href === '/' ? `/${locale}` : `/${locale}${href}`;
}

export function getLanguageAlternates(href: string): Record<string, string> {
  return Object.fromEntries([
    ...locales.map((locale) => [locale, getLocalizedPath(href, locale)]),
    ['x-default', href],
  ]);
}

export function getResolvedLocale(locale: string): Locale {
  return locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
}

interface BuildMetadataOptions {
  path: string;
  title: string;
  description: string;
  locale: string;
  ogType?: 'website' | 'article';
  ogImage?: ReturnType<typeof getMarketingOgImage>;
  noindex?: boolean;
}

/**
 * 营销页统一 metadata 构造器：保证 canonical / hreflang / OpenGraph / Twitter 一致。
 */
export function buildMetadata(opts: BuildMetadataOptions): Metadata {
  const ogImage = opts.ogImage ?? getMarketingOgImage(opts.locale);
  const localizedPath = getLocalizedPath(opts.path, opts.locale);

  return {
    title: opts.title,
    description: opts.description,
    alternates: {
      canonical: localizedPath,
      languages: getLanguageAlternates(opts.path),
    },
    openGraph: {
      type: opts.ogType ?? 'website',
      siteName: SITE_NAME,
      title: opts.title,
      description: opts.description,
      url: localizedPath,
      locale: opts.locale,
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: opts.title,
      description: opts.description,
      images: [ogImage.url],
    },
    ...(opts.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
