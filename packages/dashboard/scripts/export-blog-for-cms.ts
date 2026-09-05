/**
 * 把博客全量数据（D1 metadata + 本地 MDX 正文）导出为 muicv CMS 可导入的 JSON，
 * 供 muicv 仓库 scripts/seed-blog-articles.ts 幂等写入 articles 集合（site=muirouter）。
 *
 * 用法（在 packages/dashboard 目录下运行，需要 wrangler 登录态）:
 *   node scripts/export-blog-for-cms.ts [--dry-run]
 *
 * 产出 packages/dashboard/blog-export.json，随后在 muicv 仓库执行：
 *   MUICV_CMS_API_KEY=xxx MUIAPI_BLOG_EXPORT=<路径>/blog-export.json node scripts/seed-blog-articles.ts
 *
 * 导出规则：
 * - 文档集 = D1 blog_post_translations 的 (slug, locale) 行 × published 状态的 blog_posts；
 * - 正文按「{slug}.{locale}.mdx → {slug}.mdx(en) → 该 slug 任意语言版本」回退，
 *   gpt-6-astra 仅存在中文正文，各语言文档将共用中文正文，与线上现状一致；
 * - locale 映射 zh → zh-CN（CMS 枚举值），其余语言同名；
 * - D1 的 description 直接作为 CMS summary 与 seoDescription，tags 同步写入 keywords。
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DASHBOARD_ROOT = join(import.meta.dirname, '..');
const CONTENT_DIR = join(DASHBOARD_ROOT, 'src/content/blog');
const OUTPUT_PATH = join(DASHBOARD_ROOT, 'blog-export.json');

type D1Result<T> = { results: T[]; success: boolean };

type BlogPostRow = {
  slug: string;
  published_at: string;
  source_published_at: string;
  reading_minutes: number;
  status: string;
};

type TranslationRow = {
  slug: string;
  locale: string;
  title: string;
  description: string;
  tags_json: string;
  sources_json: string;
};

type CmsSource = { label: string; url: string };

type CmsArticleExport = {
  locale: string;
  slug: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  tags: string[];
  keywords: string[];
  sources: CmsSource[];
  sourcePublishedAt?: string;
  readingMinutes?: number;
  author: string;
  publishedAt: string;
  seoTitle: string;
  seoDescription: string;
};

const CMS_LOCALE_BY_APP_LOCALE: Record<string, string> = { zh: 'zh-CN' };

function toCmsLocale(locale: string): string {
  return CMS_LOCALE_BY_APP_LOCALE[locale] ?? locale;
}

function toIsoDate(date: string): string {
  return `${date}T00:00:00.000Z`;
}

function runD1Query(sql: string): D1Result<Record<string, unknown>> {
  const result = spawnSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'mui-api', '--remote', '--json', '--command', sql],
    { cwd: DASHBOARD_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(`wrangler d1 execute 失败（exit ${result.status}）：${result.stderr}`);
  }
  const parsed = JSON.parse(result.stdout) as D1Result<Record<string, unknown>>[];
  const first = parsed[0];
  if (!first?.success) {
    throw new Error('wrangler d1 execute 返回异常结果');
  }
  return first;
}

function parseJsonField<T>(value: string, slug: string, locale: string, fallback: T): T {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed as T;
  } catch {
    console.warn(`[${slug}/${locale}] JSON 字段解析失败，使用空值兜底`);
    return fallback;
  }
}

function parseSources(value: string, slug: string, locale: string): CmsSource[] {
  const raw = parseJsonField<unknown>(value, slug, locale, []);
  if (!Array.isArray(raw)) {
    return [];
  }
  const result: CmsSource[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const label = (item as { label?: unknown }).label;
    const url = (item as { url?: unknown }).url;
    if (typeof label === 'string' && typeof url === 'string' && label.trim() && url.trim()) {
      result.push({ label, url });
    }
  }
  return result;
}

/** 正文回退链与 lib/blog-content.ts 的 loader 指向一致：locale 版 → en 版 → 任意语言版。 */
function readBodyMarkdown(slug: string, locale: string): string {
  const candidates = [`${slug}.${locale}.mdx`, `${slug}.mdx`];
  for (const candidate of candidates) {
    try {
      return readFileSync(join(CONTENT_DIR, candidate), 'utf8');
    } catch {
      // 尝试下一个候选
    }
  }
  const fallback = readdirSync(CONTENT_DIR)
    .filter((file) => file.startsWith(`${slug}.`) && file.endsWith('.mdx'))
    .sort()[0];
  if (!fallback) {
    throw new Error(`[${slug}] 在 content/blog 下找不到任何正文文件`);
  }
  console.warn(`[${slug}/${locale}] 缺少专属正文，回退使用 ${fallback}`);
  return readFileSync(join(CONTENT_DIR, fallback), 'utf8');
}

function assertExportable(article: CmsArticleExport): void {
  if (article.title.length > 200) {
    throw new Error(`[${article.slug}/${article.locale}] title 超过 200 字符`);
  }
  if (article.summary.length > 400) {
    throw new Error(`[${article.slug}/${article.locale}] summary 超过 400 字符，需人工处理`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) {
    throw new Error(`[${article.slug}] slug 不满足 CMS 约束（小写字母/数字/连字符）`);
  }
  if (!article.bodyMarkdown.trim()) {
    throw new Error(`[${article.slug}/${article.locale}] 正文为空`);
  }
}

function collectArticles(): CmsArticleExport[] {
  const postResult = runD1Query(
    'SELECT slug, published_at, source_published_at, reading_minutes, status FROM blog_posts',
  );
  const translationResult = runD1Query(
    'SELECT slug, locale, title, description, tags_json, sources_json FROM blog_post_translations',
  );

  const posts = postResult.results as unknown as BlogPostRow[];
  const translations = translationResult.results as unknown as TranslationRow[];
  const postBySlug = new Map(posts.filter((post) => post.status === 'published').map((post) => [post.slug, post]));

  const articles: CmsArticleExport[] = [];
  for (const translation of translations) {
    const post = postBySlug.get(translation.slug);
    if (!post) {
      console.warn(`[${translation.slug}/${translation.locale}] 无 published 主记录，跳过`);
      continue;
    }

    const article: CmsArticleExport = {
      locale: toCmsLocale(translation.locale),
      slug: translation.slug,
      title: translation.title,
      summary: translation.description,
      bodyMarkdown: readBodyMarkdown(translation.slug, translation.locale),
      tags: parseJsonField<string[]>(translation.tags_json, translation.slug, translation.locale, []),
      keywords: parseJsonField<string[]>(translation.tags_json, translation.slug, translation.locale, []),
      sources: parseSources(translation.sources_json, translation.slug, translation.locale),
      sourcePublishedAt: toIsoDate(post.source_published_at),
      readingMinutes: post.reading_minutes,
      author: 'MuiRouter',
      publishedAt: toIsoDate(post.published_at),
      seoTitle: translation.title,
      seoDescription: translation.description,
    };
    assertExportable(article);
    articles.push(article);
  }

  articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.locale.localeCompare(b.locale));
  return articles;
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run');
  const articles = collectArticles();

  const bySlug = new Map<string, number>();
  for (const article of articles) {
    bySlug.set(article.slug, (bySlug.get(article.slug) ?? 0) + 1);
  }
  console.log(`共导出 ${articles.length} 条文档，覆盖 ${bySlug.size} 篇文章：`);
  for (const [slug, count] of bySlug) {
    console.log(`  ${slug} × ${count} 语言`);
  }

  if (dryRun) {
    console.log('[dry-run] 不写出文件');
    return;
  }

  writeFileSync(OUTPUT_PATH, `${JSON.stringify({ articles }, null, 2)}\n`, 'utf8');
  console.log(`已写出 ${OUTPUT_PATH}`);
}

main();
