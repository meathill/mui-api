import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ComponentType } from 'react';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { getBlogPost, getLocalizedBlogPost } from '@/lib/blog';
import { buildMetadata, getBlogPostOgImage, getLocalizedPath, getResolvedLocale, SITE_URL } from '@/lib/seo';

const POST_SLUG = 'claude-sonnet-5';

// 按 locale 懒加载 MDX，避免 8 种语言文章全部打包进同一 chunk。
// 服务端组件里的动态 import 会被 Next.js 自动按 SSG 路由切片。
const articleContentLoaders: Record<Locale, () => Promise<{ default: ComponentType }>> = {
  en: () => import('@/content/blog/claude-sonnet-5.mdx'),
  zh: () => import('@/content/blog/claude-sonnet-5.zh.mdx'),
  fr: () => import('@/content/blog/claude-sonnet-5.fr.mdx'),
  es: () => import('@/content/blog/claude-sonnet-5.es.mdx'),
  pt: () => import('@/content/blog/claude-sonnet-5.pt.mdx'),
  de: () => import('@/content/blog/claude-sonnet-5.de.mdx'),
  th: () => import('@/content/blog/claude-sonnet-5.th.mdx'),
  ja: () => import('@/content/blog/claude-sonnet-5.ja.mdx'),
};

function formatDate(locale: string, date: string) {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  const post = getBlogPost(POST_SLUG);

  if (!post) {
    return {};
  }

  const localizedPost = getLocalizedBlogPost(post, resolvedLocale);

  return buildMetadata({
    path: post.href,
    title: localizedPost.title,
    description: localizedPost.description,
    locale: resolvedLocale,
    ogType: 'article',
    ogImage: getBlogPostOgImage(POST_SLUG, resolvedLocale),
  });
}

export default async function ClaudeSonnet5BlogPostPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  setRequestLocale(resolvedLocale);
  const t = await getTranslations({ locale: resolvedLocale, namespace: 'blog' });
  const post = getBlogPost(POST_SLUG);

  if (!post) {
    notFound();
  }

  const localizedPost = getLocalizedBlogPost(post, resolvedLocale);
  const { default: ArticleContent } = await articleContentLoaders[resolvedLocale]();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: localizedPost.title,
    description: localizedPost.description,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    url: `${SITE_URL}${getLocalizedPath(post.href, resolvedLocale)}`,
    mainEntityOfPage: `${SITE_URL}${getLocalizedPath(post.href, resolvedLocale)}`,
    author: {
      '@type': 'Organization',
      name: 'MuiRouter',
    },
    publisher: {
      '@type': 'Organization',
      name: 'MuiRouter',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/favicon.svg`,
      },
    },
  };

  return (
    <article className="bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <Link
          href="/blog"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('backToBlog')}
        </Link>

        <header className="mt-8 max-w-3xl">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <time dateTime={post.publishedAt}>{formatDate(resolvedLocale, post.publishedAt)}</time>
            <span>{t('readingTime', { minutes: post.readingMinutes })}</span>
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {localizedPost.title}
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">{localizedPost.description}</p>
          <div className="mt-7 flex flex-wrap gap-2">
            {localizedPost.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </header>

        <div className="mt-12 max-w-3xl">
          <ArticleContent />
        </div>

        <section className="mt-14 max-w-3xl rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-semibold tracking-tight text-card-foreground">{t('sourcesTitle')}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t('sourcePublished', { date: formatDate(resolvedLocale, post.sourcePublishedAt) })}
          </p>
          <ul className="mt-5 grid gap-3">
            {localizedPost.sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  rel="noreferrer"
                  target="_blank"
                >
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 flex max-w-3xl flex-col gap-5 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t('articleCtaTitle')}</h2>
            <p className="mt-2 text-base leading-7 text-muted-foreground">{t('articleCtaDescription')}</p>
          </div>
          <Link
            href="/register"
            className="inline-flex min-h-11 w-fit items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t('ctaButton')}
          </Link>
        </section>
      </div>
    </article>
  );
}
