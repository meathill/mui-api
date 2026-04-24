import type { MetadataRoute } from 'next';
import { locales, defaultLocale } from '@/i18n/config';
import { BLOG_POSTS } from '@/lib/blog';

const SITE_URL = 'https://muirouter.com';

type SitemapPage = {
  path: string;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
  lastModified?: Date;
};

const pages: SitemapPage[] = [
  { path: '/', changeFrequency: 'weekly' as const, priority: 1.0 },
  { path: '/blog', changeFrequency: 'weekly' as const, priority: 0.7 },
  ...BLOG_POSTS.map((post) => ({
    path: post.href,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
    lastModified: new Date(`${post.publishedAt}T00:00:00.000Z`),
  })),
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
      lastModified: page.lastModified ?? new Date(),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: { languages },
    });
  }

  return entries;
}
