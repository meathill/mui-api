import { unstable_cache } from 'next/cache';
import { defaultLocale, type Locale } from '@/i18n/config';
import { BLOG_CONTENT_TAG, PUBLIC_CONTENT_REVALIDATE_SECONDS } from '@/lib/public-cache';
import { isBuildTime, listPublishedCmsBlogDocuments, type CmsBlogDocument } from './cms-blog-client';

// 旧导入入口：路径/hreflang 的真实实现已迁到 lib/seo.ts，这里只做转发。
export { getLanguageAlternates, getLocalizedPath, getResolvedLocale } from '@/lib/seo';

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

// CJK 按每分钟 350 字、拉丁词按每分钟 200 词粗估，仅用于 CMS 未填 readingMinutes 的文章。
function estimateReadingMinutes(markdown: string): number {
  const cjkChars = (markdown.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length;
  const latinWords = (markdown.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g) ?? []).length;
  return Math.max(1, Math.round(cjkChars / 350 + latinWords / 200));
}

/** 同一 slug 的多语言文档里做 locale 回退：请求 locale → en → 第一份可用文档。
 *  与旧 D1 pickTranslation 语义一致，保证 gpt-6-astra 这类「中文先行」文章
 *  在所有语言的列表/详情里仍然显示中文版。 */
export function pickDocumentForLocale(group: readonly CmsBlogDocument[], locale: Locale): CmsBlogDocument | null {
  return (
    group.find((doc) => doc.locale === locale) ?? group.find((doc) => doc.locale === defaultLocale) ?? group[0] ?? null
  );
}

export function toLocalizedBlogPost(document: CmsBlogDocument): LocalizedBlogPost {
  return {
    slug: document.slug,
    href: `/blog/${document.slug}`,
    title: document.title,
    description: document.description,
    publishedAt: document.publishedAt,
    sourcePublishedAt: document.sourcePublishedAt ?? document.publishedAt,
    readingMinutes: document.readingMinutes ?? estimateReadingMinutes(document.bodyMarkdown),
    tags: document.tags,
    sources: document.sources,
  };
}

const PUBLIC_CONTENT_CACHE_OPTIONS = {
  revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
  tags: [BLOG_CONTENT_TAG],
};

async function loadCmsBlogDocuments(): Promise<CmsBlogDocument[]> {
  const documents = await listPublishedCmsBlogDocuments();
  // 运行期 CMS 返回空多半是故障：抛错让 unstable_cache 保留旧值，也避免把空结果缓存一整天。
  // 构建期允许为空（CMS 尚未 seed 时降级为按需 ISR，不阻断构建）。
  if (documents.length === 0 && !isBuildTime()) {
    throw new Error('muicv CMS 返回空文章列表，疑似故障，拒绝缓存空结果');
  }
  return documents;
}

function getCmsBlogDocuments(): Promise<CmsBlogDocument[]> {
  // v2：首版部署时构建期可能写入空结果脏缓存，bump 键强制失效一次。
  return unstable_cache(loadCmsBlogDocuments, ['cms-blog-documents-v2'], PUBLIC_CONTENT_CACHE_OPTIONS)();
}

export async function getLocalizedBlogPosts(locale: Locale): Promise<LocalizedBlogPost[]> {
  const documents = await getCmsBlogDocuments();
  const groupsBySlug = new Map<string, CmsBlogDocument[]>();
  for (const document of documents) {
    const group = groupsBySlug.get(document.slug) ?? [];
    group.push(document);
    groupsBySlug.set(document.slug, group);
  }

  return [...groupsBySlug.values()]
    .map((group) => {
      const representative = pickDocumentForLocale(group, locale);
      return representative ? toLocalizedBlogPost(representative) : null;
    })
    .filter((post): post is LocalizedBlogPost => post !== null)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));
}

async function findCmsBlogDocument(slug: string, locale: Locale): Promise<CmsBlogDocument | null> {
  const documents = await getCmsBlogDocuments();
  return pickDocumentForLocale(
    documents.filter((document) => document.slug === slug),
    locale,
  );
}

export async function getLocalizedBlogPost(slug: string, locale: Locale): Promise<LocalizedBlogPost | null> {
  const document = await findCmsBlogDocument(slug, locale);
  return document ? toLocalizedBlogPost(document) : null;
}

/** 详情页正文：返回该 locale（含回退）文章的 Markdown 原文。 */
export async function getBlogContent(slug: string, locale: Locale): Promise<string | null> {
  const document = await findCmsBlogDocument(slug, locale);
  return document?.bodyMarkdown ?? null;
}

export async function getPublishedBlogSitemapPosts(): Promise<BlogSitemapPost[]> {
  const documents = await getCmsBlogDocuments();
  const publishedAtBySlug = new Map<string, string>();
  for (const document of documents) {
    if (!publishedAtBySlug.has(document.slug)) {
      publishedAtBySlug.set(document.slug, document.publishedAt);
    }
  }

  return [...publishedAtBySlug.entries()].map(([slug, publishedAt]) => ({
    slug,
    href: `/blog/${slug}`,
    publishedAt,
  }));
}
