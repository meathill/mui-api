import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getLocalizedBlogPosts } from '@/lib/blog';
import { buildMetadata, getLocalizedPath, getResolvedLocale, SITE_URL } from '@/lib/seo';

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
  const t = await getTranslations({ locale: resolvedLocale, namespace: 'blog.metadata' });

  return buildMetadata({
    path: '/blog',
    title: t('title'),
    description: t('description'),
    locale: resolvedLocale,
  });
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  setRequestLocale(resolvedLocale);
  const t = await getTranslations({ locale: resolvedLocale, namespace: 'blog' });
  const posts = getLocalizedBlogPosts(resolvedLocale);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'MuiRouter Blog',
    url: `${SITE_URL}${getLocalizedPath('/blog', resolvedLocale)}`,
    blogPost: posts.map((post) => ({
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      dateModified: post.publishedAt,
      url: `${SITE_URL}${getLocalizedPath(post.href, resolvedLocale)}`,
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
    })),
  };

  return (
    <div className="bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-16 sm:py-20">
        <div className="max-w-3xl">
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{t('eyebrow')}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">{t('title')}</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="grid gap-5">
          {posts.map((post) => (
            <article key={post.slug} className="rounded-lg border border-border bg-card p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                <time dateTime={post.publishedAt}>{formatDate(resolvedLocale, post.publishedAt)}</time>
                <span>{t('readingTime', { minutes: post.readingMinutes })}</span>
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-card-foreground sm:text-3xl">
                <Link href={post.href} className="hover:text-primary">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-4 max-w-3xl text-base leading-8 text-muted-foreground">{post.description}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <Link
                href={post.href}
                className="mt-7 inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t('readArticle')}
              </Link>
            </article>
          ))}
        </div>

        <div className="flex flex-col gap-5 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t('ctaTitle')}</h2>
            <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">{t('ctaDescription')}</p>
          </div>
          <Link
            href="/register"
            className="inline-flex min-h-11 w-fit items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t('ctaButton')}
          </Link>
        </div>
      </section>
    </div>
  );
}
