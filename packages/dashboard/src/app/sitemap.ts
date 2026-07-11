import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/config';
import { getPublishedBlogSitemapPosts } from '@/lib/blog';
import { getLanguageAlternates, getLocalizedPath, SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type SitemapPage = {
  path: string;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
  lastModified: Date;
};

// 静态页 lastModified 维护时手动更新；避免 sitemap 每次构建都变更欺骗搜索引擎。
const STATIC_PAGES_UPDATED_AT = new Date('2026-07-11');

function toAbsoluteAlternates(altPaths: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(altPaths).map(([key, path]) => [key, `${SITE_URL}${path}`]));
}

export function buildSitemapEntries(blogPosts: Awaited<ReturnType<typeof getPublishedBlogSitemapPosts>>) {
  const pages: SitemapPage[] = [
    { path: '/', changeFrequency: 'weekly', priority: 1.0, lastModified: STATIC_PAGES_UPDATED_AT },
    { path: '/blog', changeFrequency: 'weekly', priority: 0.7, lastModified: STATIC_PAGES_UPDATED_AT },
    ...blogPosts.map<SitemapPage>((post) => ({
      path: post.href,
      changeFrequency: 'monthly',
      priority: 0.6,
      lastModified: new Date(`${post.publishedAt}T00:00:00.000Z`),
    })),
    { path: '/pricing', changeFrequency: 'monthly', priority: 0.8, lastModified: STATIC_PAGES_UPDATED_AT },
    { path: '/mcp', changeFrequency: 'monthly', priority: 0.7, lastModified: STATIC_PAGES_UPDATED_AT },
    { path: '/ai-router', changeFrequency: 'monthly', priority: 0.8, lastModified: STATIC_PAGES_UPDATED_AT },
    { path: '/llm-router', changeFrequency: 'monthly', priority: 0.7, lastModified: STATIC_PAGES_UPDATED_AT },
    {
      path: '/openai-compatible-router',
      changeFrequency: 'monthly',
      priority: 0.7,
      lastModified: STATIC_PAGES_UPDATED_AT,
    },
    { path: '/mcp-router', changeFrequency: 'monthly', priority: 0.7, lastModified: STATIC_PAGES_UPDATED_AT },
    { path: '/register', changeFrequency: 'monthly', priority: 0.6, lastModified: STATIC_PAGES_UPDATED_AT },
    // /login 不在 sitemap：layout 已设 robots: noindex，与 sitemap 收录冲突会让 GSC 报错。
  ];
  const entries: MetadataRoute.Sitemap = [];

  for (const page of pages) {
    const languages = toAbsoluteAlternates(getLanguageAlternates(page.path));
    for (const locale of locales) {
      entries.push({
        url: `${SITE_URL}${getLocalizedPath(page.path, locale)}`,
        lastModified: page.lastModified,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: { languages },
      });
    }
  }

  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const blogPosts = await getPublishedBlogSitemapPosts();
  return buildSitemapEntries(blogPosts);
}
