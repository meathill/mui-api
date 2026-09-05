import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AwesomeComment } from '@/components/marketing/awesome-comment';
import { MarkdownRenderer } from '@/components/marketing/markdown-renderer';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/navigation';
import { getBlogContent, getLocalizedBlogPost, getPublishedBlogSitemapPosts, type LocalizedBlogPost } from '@/lib/blog';
import { buildMetadata, getBlogPostOgImage, getLocalizedPath, getResolvedLocale, SITE_URL } from '@/lib/seo';

// 文章元数据与正文来自 muicv CMS（lib/blog.ts 内 unstable_cache 做天级缓存）；
// 构建期走公网 URL 预渲染默认 locale 的文章页，其余 locale 按需 ISR。
export const revalidate = 86_400;

// CMS 构建期不可用（或尚未 seed）时返回空数组，降级为按需 ISR，不阻断构建。
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  try {
    const posts = await getPublishedBlogSitemapPosts();
    return posts.map((post) => ({ slug: post.slug }));
  } catch {
    return [];
  }
}

function formatDate(locale: string, date: string) {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  const post = await getLocalizedBlogPost(slug, resolvedLocale);

  if (!post) {
    return {};
  }

  return buildMetadata({
    path: post.href,
    title: post.title,
    description: post.description,
    locale: resolvedLocale,
    ogType: 'article',
    ogImage: getBlogPostOgImage(slug, resolvedLocale),
  });
}

// 两处 notFound() 都必须在任何 Suspense 边界之外跑完：外层 shell 一旦 flush，
// 响应状态就锁死在 200，不存在的 slug 会变成 soft 404 被搜索引擎当成正常页面收录。
export default async function BlogPostPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  setRequestLocale(resolvedLocale);
  const [content, post] = await Promise.all([
    getBlogContent(slug, resolvedLocale),
    getLocalizedBlogPost(slug, resolvedLocale),
  ]);

  if (!content || !post) {
    notFound();
  }

  return <BlogArticle locale={resolvedLocale} post={post} content={content} />;
}

async function BlogArticle({
  locale,
  post,
  content,
}: {
  locale: Locale;
  post: LocalizedBlogPost;
  content: string;
}) {
  const t = await getTranslations({ locale, namespace: 'blog' });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    url: `${SITE_URL}${getLocalizedPath(post.href, locale)}`,
    mainEntityOfPage: `${SITE_URL}${getLocalizedPath(post.href, locale)}`,
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
          <MarkdownRenderer content={content} />
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

        <AwesomeComment />
      </div>
    </article>
  );
}
