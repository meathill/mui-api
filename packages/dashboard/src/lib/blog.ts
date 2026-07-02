import { and, desc, eq, inArray } from 'drizzle-orm';
import { blogPostTranslations, blogPosts, type BlogPost, type BlogPostTranslation } from '@/db/app-schema';
import { defaultLocale, type Locale } from '@/i18n/config';
import { getDb } from '@/lib/db';

// 旧导入入口：路径/hreflang 的真实实现已迁到 lib/seo.ts，这里只做转发。
export { getLanguageAlternates, getLocalizedPath, getResolvedLocale } from '@/lib/seo';

const PUBLISHED_STATUS = 'published';

export type BlogSource = {
  label: string;
  url: string;
};

export type LocalizedBlogPost = {
  slug: string;
  href: string;
  title: string;
  description: string;
  publishedAt: string;
  sourcePublishedAt: string;
  readingMinutes: number;
  tags: readonly string[];
  sources: readonly BlogSource[];
};

export type BlogSitemapPost = {
  slug: string;
  href: string;
  publishedAt: string;
};

function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function parseSources(value: string): BlogSource[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is BlogSource => {
      if (typeof item !== 'object' || item === null) {
        return false;
      }
      const source = item as Record<string, unknown>;
      return typeof source.label === 'string' && typeof source.url === 'string';
    });
  } catch {
    return [];
  }
}

function pickTranslation(translations: readonly BlogPostTranslation[], locale: Locale): BlogPostTranslation | null {
  return (
    translations.find((translation) => translation.locale === locale) ??
    translations.find((translation) => translation.locale === defaultLocale) ??
    translations[0] ??
    null
  );
}

export function toLocalizedBlogPost(
  post: BlogPost,
  translations: readonly BlogPostTranslation[],
  locale: Locale,
): LocalizedBlogPost | null {
  const translation = pickTranslation(translations, locale);
  if (!translation) {
    return null;
  }

  return {
    slug: post.slug,
    href: `/blog/${post.slug}`,
    title: translation.title,
    description: translation.description,
    publishedAt: post.publishedAt,
    sourcePublishedAt: post.sourcePublishedAt,
    readingMinutes: post.readingMinutes,
    tags: parseStringArray(translation.tagsJson),
    sources: parseSources(translation.sourcesJson),
  };
}

function groupTranslationsBySlug(translations: readonly BlogPostTranslation[]): Map<string, BlogPostTranslation[]> {
  const groups = new Map<string, BlogPostTranslation[]>();
  for (const translation of translations) {
    const group = groups.get(translation.slug) ?? [];
    group.push(translation);
    groups.set(translation.slug, group);
  }
  return groups;
}

export function toPublishedLocalizedBlogPosts(
  posts: readonly BlogPost[],
  translations: readonly BlogPostTranslation[],
  locale: Locale,
): LocalizedBlogPost[] {
  const translationsBySlug = groupTranslationsBySlug(translations);
  return posts
    .filter((post) => post.status === PUBLISHED_STATUS)
    .map((post) => toLocalizedBlogPost(post, translationsBySlug.get(post.slug) ?? [], locale))
    .filter((post): post is LocalizedBlogPost => post !== null);
}

async function getTranslationsForSlugs(slugs: readonly string[]): Promise<BlogPostTranslation[]> {
  if (slugs.length === 0) {
    return [];
  }

  const db = await getDb();
  return db
    .select()
    .from(blogPostTranslations)
    .where(inArray(blogPostTranslations.slug, [...slugs]));
}

export async function getLocalizedBlogPosts(locale: Locale): Promise<LocalizedBlogPost[]> {
  const db = await getDb();
  const posts = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.status, PUBLISHED_STATUS))
    .orderBy(desc(blogPosts.publishedAt));
  const translations = await getTranslationsForSlugs(posts.map((post) => post.slug));
  return toPublishedLocalizedBlogPosts(posts, translations, locale);
}

export async function getLocalizedBlogPost(slug: string, locale: Locale): Promise<LocalizedBlogPost | null> {
  const db = await getDb();
  const [post] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, PUBLISHED_STATUS)))
    .limit(1);

  if (!post) {
    return null;
  }

  const translations = await db.select().from(blogPostTranslations).where(eq(blogPostTranslations.slug, slug));
  return toLocalizedBlogPost(post, translations, locale);
}

export async function getPublishedBlogSitemapPosts(): Promise<BlogSitemapPost[]> {
  const db = await getDb();
  const posts = await db
    .select({
      slug: blogPosts.slug,
      publishedAt: blogPosts.publishedAt,
    })
    .from(blogPosts)
    .where(eq(blogPosts.status, PUBLISHED_STATUS))
    .orderBy(desc(blogPosts.publishedAt));

  return posts.map((post) => ({
    slug: post.slug,
    href: `/blog/${post.slug}`,
    publishedAt: post.publishedAt,
  }));
}
