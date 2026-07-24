import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildMetadata, getResolvedLocale } from '@/lib/seo';
import { RouterLanding } from '../_components/router-landing';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  const t = await getTranslations({ locale: resolvedLocale, namespace: 'geminiApiGateway' });

  return buildMetadata({
    path: '/gemini-api-gateway',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale: resolvedLocale,
  });
}

export default async function GeminiApiGatewayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RouterLanding namespace="geminiApiGateway" path="/gemini-api-gateway" locale={locale} />;
}
