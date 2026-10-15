import type { Metadata } from 'next';
import { defaultLocale, type Locale, locales } from '@/i18n/config';

export const SITE_NAME = 'MuiRouter';
export const SITE_URL = 'https://muirouter.com';
export const MARKETING_OG_IMAGE_ALT = 'MuiRouter - AI API Router for Every LLM';
export const MARKETING_OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/** 文案只有中英两套的营销页（联系页、模型目录）：其余语言页仍可访问，
 *  但 canonical / hreflang 收敛到英文版，避免同一份英文内容被当成多语言重复页。 */
export const BILINGUAL_CONTENT_LOCALES: readonly Locale[] = ['en', 'zh'];

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

/** 按 i18n 配置顺序排列语言，保证 hreflang / canonical 落点的确定性（en → zh → …）。 */
function orderByConfiguredLocales(availableLocales: readonly Locale[]): Locale[] {
  return locales.filter((locale) => availableLocales.includes(locale));
}

/** 有译文的语言里按配置顺序取第一个：无译文页的 canonical 与 x-default 落到这里。
 *  en 有译文即 en，只有中文原文时落到 zh（gpt-6-astra 这类「中文先行」文章）。 */
export function getPrimaryLocale(availableLocales: readonly Locale[]): Locale {
  return orderByConfiguredLocales(availableLocales)[0] ?? defaultLocale;
}

/** hreflang 只列真正有译文的语言，外加指向主语言的 x-default。
 *  给无译文语言声明 hreflang（哪怕是自指）会让搜索引擎把它们当成独立重复页。 */
export function getLanguageAlternates(
  href: string,
  availableLocales: readonly Locale[] = locales,
): Record<string, string> {
  const available = orderByConfiguredLocales(availableLocales);
  return Object.fromEntries([
    ...available.map((locale) => [locale, getLocalizedPath(href, locale)]),
    ['x-default', getLocalizedPath(href, getPrimaryLocale(available))],
  ]);
}

export function getResolvedLocale(locale: string): Locale {
  return locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
}

interface BuildMetadataOptions {
  path: string;
  title: string;
  description: string;
  locale: Locale;
  /** 该 path 有真实译文的语言集合；省略 = 全语言。
   *  未列出的语言页仍可访问，但 canonical / hreflang / OG url 都收敛到主语言版本。 */
  translations?: readonly Locale[];
  ogType?: 'website' | 'article';
  ogImage?: ReturnType<typeof getMarketingOgImage>;
  noindex?: boolean;
}

/**
 * 营销页统一 metadata 构造器：保证 canonical / hreflang / OpenGraph / Twitter 一致。
 */
export function buildMetadata(opts: BuildMetadataOptions): Metadata {
  const translations = opts.translations ?? locales;
  const canonicalLocale = translations.includes(opts.locale) ? opts.locale : getPrimaryLocale(translations);
  const canonicalPath = getLocalizedPath(opts.path, canonicalLocale);
  const ogImage = opts.ogImage ?? getMarketingOgImage(opts.locale);

  return {
    title: opts.title,
    description: opts.description,
    alternates: {
      canonical: canonicalPath,
      languages: getLanguageAlternates(opts.path, translations),
    },
    openGraph: {
      type: opts.ogType ?? 'website',
      siteName: SITE_NAME,
      title: opts.title,
      description: opts.description,
      url: canonicalPath,
      locale: canonicalLocale,
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
