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
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'metadata' });

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
      {
        '@type': 'WebApplication',
        name: 'MuiRouter',
        url: 'https://muirouter.com',
        isPartOf: { '@id': 'https://muirouter.com/#website' },
        provider: { '@id': 'https://muirouter.com/#organization' },
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'All',
        description: t('description'),
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          description: t('title'),
        },
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
      <CtaSection />
    </div>
  );
}
