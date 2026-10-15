import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { getLegalContent, getLegalDocLocales } from '@/lib/legal-content';
import { getBilingualPageMeta } from '@/lib/page-meta';
import { buildMetadata, getResolvedLocale } from '@/lib/seo';

export function generateStaticParams() {
  return [
    { locale: 'en' },
    { locale: 'zh' },
    { locale: 'fr' },
    { locale: 'es' },
    { locale: 'pt' },
    { locale: 'de' },
    { locale: 'th' },
    { locale: 'ja' },
  ];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolved = getResolvedLocale(locale);
  const { title, description } = getBilingualPageMeta('terms', resolved);
  return buildMetadata({
    path: '/terms',
    title,
    description,
    locale: resolved,
    translations: getLegalDocLocales('terms'),
  });
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolved = getResolvedLocale(locale);
  setRequestLocale(resolved);
  const Content = await getLegalContent('terms', resolved);
  return (
    <article className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <Content />
      </div>
    </article>
  );
}
