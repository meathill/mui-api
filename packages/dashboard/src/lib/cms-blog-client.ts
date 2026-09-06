// muicv Payload CMS（cms.muicv.com）articles 集合的只读客户端。
//
// 背景：博客内容源从本地 MDX + D1 迁到多站点共用的 muicv CMS（见 muicv 仓库
// packages/cms/collections/articles.ts），本站点过滤 site=muirouter。
// 公开页面匿名只读 status=published，编辑统一去 Payload 后台。
//
// 数据形状对齐 blog.ts 的 LocalizedBlogPost（title/description/tags/sources/
// readingMinutes/publishedAt），CMS 的 locale（zh-CN 等）在此层映射回站点 locale。

import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Locale } from '@/i18n/config';

const CMS_BASE_URL = process.env.MUICV_CMS_URL?.trim() || 'https://cms.muicv.com';

/** 本站点在 articles 集合中的 site 标识。 */
export const CMS_BLOG_SITE = 'muirouter';

/** 单次拉取上限：14 篇 × 8 语言 = 112 条，200 足够；超出后需要改成分页拉取。 */
const CMS_LIST_LIMIT = 200;

/** 是否处于生产构建期（Workers Builds / 本地 next build）。
 *  构建期 platformProxy 会给 MUICV_CMS 一个不可用的本地 stub，必须走公网 URL，
 *  运行时才用 service binding 内网调用。 */
export function isBuildTime(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

/** 运行时（worker 内）优先走 service binding：同账号内网调用，不出公网。
 *  build 期（Node 进程）拿不到可用 binding，回落公网 URL。
 *  注意 binding.fetch 不接受相对路径（Invalid URL），必须给完整 URL；
 *  workerd 只按 binding 路由，host 用虚构值即可。 */
const BINDING_BASE_URL = 'https://muicv-cms.internal';

async function resolveCmsFetch(): Promise<{ fetchImpl: typeof fetch; baseUrl: string }> {
  if (!isBuildTime()) {
    try {
      const { env } = await getCloudflareContext({ async: true });
      if (env.MUICV_CMS && typeof env.MUICV_CMS.fetch === 'function') {
        const binding = env.MUICV_CMS;
        return {
          fetchImpl: ((input, init) => binding.fetch(input, init)) as typeof fetch,
          baseUrl: BINDING_BASE_URL,
        };
      }
    } catch {
      // 无 Cloudflare runtime（本地 Node 脚本、单测等）：走公网
    }
  }
  return { fetchImpl: fetch, baseUrl: CMS_BASE_URL };
}

/** CMS locale → 站点 locale（i18n/config.ts），反向映射的键就是站点 locale 白名单。 */
const CMS_LOCALE_BY_APP_LOCALE: Record<Locale, string> = {
  en: 'en',
  zh: 'zh-CN',
  fr: 'fr',
  es: 'es',
  pt: 'pt',
  de: 'de',
  th: 'th',
  ja: 'ja',
};

const APP_LOCALE_BY_CMS_LOCALE = new Map(
  Object.entries(CMS_LOCALE_BY_APP_LOCALE).map(([appLocale, cmsLocale]) => [cmsLocale, appLocale as Locale]),
);

export function toCmsLocale(locale: Locale): string {
  return CMS_LOCALE_BY_APP_LOCALE[locale];
}

type CmsArticleRaw = {
  site?: unknown;
  locale?: unknown;
  title?: unknown;
  slug?: unknown;
  status?: unknown;
  summary?: unknown;
  bodyMarkdown?: unknown;
  tags?: unknown;
  sources?: unknown;
  sourcePublishedAt?: unknown;
  readingMinutes?: unknown;
  publishedAt?: unknown;
};

/** CMS articles 文档映射后的站点形状；publishedAt 统一为 YYYY-MM-DD。 */
export type CmsBlogDocument = {
  slug: string;
  locale: Locale;
  title: string;
  description: string;
  bodyMarkdown: string;
  tags: string[];
  sources: Array<{ label: string; url: string }>;
  sourcePublishedAt: string | null;
  readingMinutes: number | null;
  publishedAt: string;
};

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'object' && item !== null ? readString((item as { value?: unknown }).value) : null))
    .filter((item): item is string => item !== null);
}

function readSourceList(value: unknown): Array<{ label: string; url: string }> {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: Array<{ label: string; url: string }> = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const label = readString((item as { label?: unknown }).label);
    const url = readString((item as { url?: unknown }).url);
    if (label && url) {
      result.push({ label, url });
    }
  }
  return result;
}

/** ISO 日期时间截取为 YYYY-MM-DD；页面 formatDate 依赖这个格式。 */
function toBlogDate(value: unknown): string | null {
  const text = readString(value);
  if (!text || !/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return null;
  }
  return text.slice(0, 10);
}

export function parseCmsBlogDocument(value: unknown): CmsBlogDocument | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const doc = value as CmsArticleRaw;

  if (doc.site !== CMS_BLOG_SITE || doc.status !== 'published') {
    return null;
  }
  const slug = readString(doc.slug);
  const title = readString(doc.title);
  const description = readString(doc.summary);
  const bodyMarkdown = readString(doc.bodyMarkdown);
  const publishedAt = toBlogDate(doc.publishedAt);
  const cmsLocale = readString(doc.locale);
  const locale = cmsLocale ? APP_LOCALE_BY_CMS_LOCALE.get(cmsLocale) : undefined;
  if (!slug || !title || !description || !bodyMarkdown || !publishedAt || !locale) {
    return null;
  }

  const readingMinutes =
    typeof doc.readingMinutes === 'number' && Number.isFinite(doc.readingMinutes) && doc.readingMinutes > 0
      ? doc.readingMinutes
      : null;

  return {
    slug,
    locale,
    title,
    description,
    bodyMarkdown,
    tags: readStringList(doc.tags),
    sources: readSourceList(doc.sources),
    sourcePublishedAt: toBlogDate(doc.sourcePublishedAt),
    readingMinutes,
    publishedAt,
  };
}

export function parseCmsBlogDocuments(value: unknown): CmsBlogDocument[] {
  if (!value || typeof value !== 'object') {
    return [];
  }
  const docs = (value as { docs?: unknown }).docs;
  if (!Array.isArray(docs)) {
    return [];
  }
  return docs
    .map((doc) => parseCmsBlogDocument(doc))
    .filter((doc): doc is CmsBlogDocument => doc !== null)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));
}

async function fetchCmsDocs(query: URLSearchParams, fetchImpl?: typeof fetch): Promise<unknown | null> {
  const resolved = fetchImpl ? { fetchImpl, baseUrl: CMS_BASE_URL } : await resolveCmsFetch();
  try {
    // service binding 时 baseUrl 为虚构 host，workerd 只按 binding 路由、忽略 host
    const response = await resolved.fetchImpl(`${resolved.baseUrl}/api/articles?${query.toString()}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      console.warn(`[cms-blog-client] CMS articles HTTP ${response.status}`);
      return null;
    }
    return (await response.json()) as unknown;
  } catch (error) {
    console.warn(`[cms-blog-client] CMS articles 拉取失败: ${error}`);
    return null;
  }
}

/** 拉取本站点全部已发布文章（一次全量，列表/详情/sitemap 共用）。
 *  CMS 不可达时返回空数组，由调用方决定降级行为。 */
export async function listPublishedCmsBlogDocuments(fetchImpl?: typeof fetch): Promise<CmsBlogDocument[]> {
  const query = new URLSearchParams({
    depth: '0',
    limit: String(CMS_LIST_LIMIT),
    sort: '-publishedAt',
    'where[site][equals]': CMS_BLOG_SITE,
    'where[status][equals]': 'published',
  });

  const payload = await fetchCmsDocs(query, fetchImpl);
  if (!payload) {
    return [];
  }
  return parseCmsBlogDocuments(payload);
}
