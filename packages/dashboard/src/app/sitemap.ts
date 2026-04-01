import type { MetadataRoute } from 'next';
import { locales, defaultLocale } from '@/i18n/config';

const SITE_URL = 'https://muirouter.com';

const pages = ['/', '/register', '/login'];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    const languages: Record<string, string> = {};
    for (const locale of locales) {
      languages[locale] = locale === defaultLocale ? `${SITE_URL}${page}` : `${SITE_URL}/${locale}${page}`;
    }

    entries.push({
      url: `${SITE_URL}${page}`,
      lastModified: new Date(),
      changeFrequency: page === '/' ? 'weekly' : 'monthly',
      priority: page === '/' ? 1.0 : page === '/register' ? 0.8 : 0.5,
      alternates: { languages },
    });
  }

  return entries;
}
