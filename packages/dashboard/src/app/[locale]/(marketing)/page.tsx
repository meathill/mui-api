import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { HeroSection } from './_components/hero-section';
import { ModelsSection } from './_components/models-section';
import { AdvantagesSection } from './_components/advantages-section';
import { StepsSection } from './_components/steps-section';
import { CodeSection } from './_components/code-section';
import { CtaSection } from './_components/cta-section';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: `MUI Router - ${t('ogTitle')}`,
    description: t('description'),
    alternates: {
      canonical: '/',
    },
  };
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'MUI Router',
        url: 'https://muirouter.com',
        logo: 'https://muirouter.com/favicon.svg',
      },
      {
        '@type': 'WebApplication',
        name: 'MUI Router',
        url: 'https://muirouter.com',
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
      <AdvantagesSection />
      <StepsSection />
      <CodeSection />
      <CtaSection />
    </div>
  );
}
