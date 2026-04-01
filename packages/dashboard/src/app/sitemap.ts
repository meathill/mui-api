import type { MetadataRoute } from 'next';
import { locales, defaultLocale } from '@/i18n/config';

const SITE_URL = 'https://muirouter.com';

const pages = [
  { path: '/', changeFrequency: 'weekly' as const, priority: 1.0 },
  { path: '/pricing', changeFrequency: 'monthly' as const, priority: 0.8 },
  { path: '/register', changeFrequency: 'monthly' as const, priority: 0.8 },
  { path: '/login', changeFrequency: 'monthly' as const, priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    const languages: Record<string, string> = {};
    for (const locale of locales) {
      languages[locale] = locale === defaultLocale ? `${SITE_URL}${page.path}` : `${SITE_URL}/${locale}${page.path}`;
    }

    entries.push({
      url: `${SITE_URL}${page.path}`,
      lastModified: new Date(),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: { languages },
    });
  }

  return entries;
}
