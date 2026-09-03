import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildMetadata, getResolvedLocale } from '@/lib/seo';
import { AdvantagesSection } from './_components/advantages-section';
import { CodeSection } from './_components/code-section';
import { CtaSection } from './_components/cta-section';
import { HeroSection } from './_components/hero-section';
import { HomeFaqSection } from './_components/home-faq-section';
import { ImageSection } from './_components/image-section';
import { ModelsSection } from './_components/models-section';
import { StepsSection } from './_components/steps-section';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  const t = await getTranslations({ locale: resolvedLocale, namespace: 'metadata' });

  return buildMetadata({
    path: '/',
    // 根 layout 已设 title.template = "%s | MuiRouter"，这里只传可变部分。
    title: t('ogTitle'),
    description: t('description'),
    locale: resolvedLocale,
  });
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  setRequestLocale(resolvedLocale);
  const t = await getTranslations({ locale: resolvedLocale, namespace: 'metadata' });

  // Issue #12：无真实、页面可见的评价体系时不输出 WebApplication/SoftwareApplication，
  // 否则 Google Rich Results 会报缺 aggregateRating/review，且不能伪造评分。
  // 首页 FAQ 结构化数据由 HomeFaqSection 独立输出，这里只保留 Organization + WebSite。
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://muirouter.com/#organization',
        name: 'MuiRouter',
        url: 'https://muirouter.com',
        logo: 'https://muirouter.com/favicon.svg',
      },
      {
        '@type': 'WebSite',
        '@id': 'https://muirouter.com/#website',
        name: 'MuiRouter',
        url: 'https://muirouter.com',
        description: t('description'),
        publisher: { '@id': 'https://muirouter.com/#organization' },
      },
    ],
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HeroSection />
      <ModelsSection />
      <ImageSection />
      <AdvantagesSection />
      <StepsSection />
      <CodeSection />
      <HomeFaqSection />
      {resolvedLocale === 'zh' && <CtaSection />}
    </div>
  );
}
