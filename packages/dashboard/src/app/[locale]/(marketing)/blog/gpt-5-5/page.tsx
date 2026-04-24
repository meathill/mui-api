import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getBlogPost } from '@/lib/blog';
import ArticleContent from '@/content/blog/gpt-5-5.mdx';

const SITE_URL = 'https://muirouter.com';
const POST_SLUG = 'gpt-5-5';

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
  const post = getBlogPost(POST_SLUG);

  if (!post) {
    return {};
  }

  return {
    title: `MUI Router - ${post.title}`,
    description: post.description,
    alternates: {
      canonical: post.href,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.publishedAt,
      locale,
      url: post.href,
    },
  };
}

export default async function Gpt55BlogPostPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'blog' });
  const post = getBlogPost(POST_SLUG);

  if (!post) {
    notFound();
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    url: `${SITE_URL}${post.href}`,
    mainEntityOfPage: `${SITE_URL}${post.href}`,
    author: {
      '@type': 'Organization',
      name: 'MUI Router',
    },
    publisher: {
      '@type': 'Organization',
      name: 'MUI Router',
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
            <time dateTime={post.publishedAt}>{formatDate(locale, post.publishedAt)}</time>
            <span>{t('readingTime', { minutes: post.readingMinutes })}</span>
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">{post.title}</h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground">{post.description}</p>
          <div className="mt-7 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
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
            {t('sourcePublished', { date: formatDate(locale, post.sourcePublishedAt) })}
          </p>
          <ul className="mt-5 grid gap-3">
            {post.sources.map((source) => (
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
