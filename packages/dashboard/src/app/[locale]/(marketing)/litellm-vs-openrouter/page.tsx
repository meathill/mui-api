import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildMetadata, getResolvedLocale } from '@/lib/seo';
import { RouterLanding } from '../_components/router-landing';

const COMPARISON_COLUMNS = ['LiteLLM', 'OpenRouter', 'MuiRouter'];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  const t = await getTranslations({ locale: resolvedLocale, namespace: 'litellmVsOpenrouter' });

  return buildMetadata({
    path: '/litellm-vs-openrouter',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale: resolvedLocale,
  });
}

export default async function LitellmVsOpenrouterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <RouterLanding
      namespace="litellmVsOpenrouter"
      path="/litellm-vs-openrouter"
      locale={locale}
      variant="comparisonTable"
      comparisonColumns={COMPARISON_COLUMNS}
      highlightColumnIndex={2}
    />
  );
}
