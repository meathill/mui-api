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
  const title = resolved === 'zh' ? '关于我们 - MuiRouter' : 'About - MuiRouter';
  const description =
    resolved === 'zh'
      ? 'MuiRouter 的愿景：在每一个大模型之上做稳定透明的路由层。'
      : 'The vision behind MuiRouter: a stable routing layer for every LLM.';
  return buildMetadata({ path: '/about', title, description, locale: resolved });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolved = getResolvedLocale(locale);
  setRequestLocale(resolved);
  const Content = await getLegalContent('about', resolved);
  return (
    <article className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <Content />
      </div>
    </article>
  );
}
