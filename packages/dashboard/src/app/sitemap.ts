import type { MetadataRoute } from 'next';
import { defaultLocale, locales } from '@/i18n/config';
import { BLOG_POSTS } from '@/lib/blog';

const SITE_URL = 'https://muirouter.com';

type SitemapPage = {
  path: string;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
  lastModified: Date;
};

// 静态页 lastModified 维护时手动更新；避免 sitemap 每次构建都变更欺骗搜索引擎。
const STATIC_PAGES_UPDATED_AT = new Date('2026-05-29');

const pages: SitemapPage[] = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0, lastModified: STATIC_PAGES_UPDATED_AT },
  { path: '/blog', changeFrequency: 'weekly', priority: 0.7, lastModified: STATIC_PAGES_UPDATED_AT },
  ...BLOG_POSTS.map<SitemapPage>((post) => ({
    path: post.href,
    changeFrequency: 'monthly',
    priority: 0.6,
    lastModified: new Date(`${post.publishedAt}T00:00:00.000Z`),
  })),
  { path: '/pricing', changeFrequency: 'monthly', priority: 0.8, lastModified: STATIC_PAGES_UPDATED_AT },
  { path: '/mcp', changeFrequency: 'monthly', priority: 0.7, lastModified: STATIC_PAGES_UPDATED_AT },
  { path: '/register', changeFrequency: 'monthly', priority: 0.6, lastModified: STATIC_PAGES_UPDATED_AT },
  // /login 不在 sitemap：layout 已设 robots: noindex，与 sitemap 收录冲突会让 GSC 报错。
];

function getLocalizedPath(path: string, locale: (typeof locales)[number]) {
  if (locale === defaultLocale) {
    return path;
  }

  return path === '/' ? `/${locale}/` : `/${locale}${path}`;
}

function getAbsoluteUrl(path: string) {
  return `${SITE_URL}${path}`;
}

function getLanguageAlternates(path: string) {
  const languages = Object.fromEntries(
    locales.map((locale) => [locale, getAbsoluteUrl(getLocalizedPath(path, locale))]),
  );
  return {
    ...languages,
    'x-default': getAbsoluteUrl(getLocalizedPath(path, defaultLocale)),
  };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    const languages = getLanguageAlternates(page.path);
    for (const locale of locales) {
      entries.push({
        url: getAbsoluteUrl(getLocalizedPath(page.path, locale)),
        lastModified: page.lastModified,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: { languages },
      });
    }
  }

  return entries;
}
