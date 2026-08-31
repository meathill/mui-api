import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { getLegalContent } from '@/lib/legal-content';
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
  const title = resolved === 'zh' ? '隐私政策 - MuiRouter' : 'Privacy Policy - MuiRouter';
  const description =
    resolved === 'zh'
      ? 'MuiRouter 隐私政策，了解我们如何收集与使用数据。'
      : 'MuiRouter Privacy Policy — how we collect and use data.';
  return buildMetadata({ path: '/privacy', title, description, locale: resolved });
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolved = getResolvedLocale(locale);
  setRequestLocale(resolved);
  const Content = await getLegalContent('privacy', resolved);
  return (
    <article className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <Content />
      </div>
    </article>
  );
}
