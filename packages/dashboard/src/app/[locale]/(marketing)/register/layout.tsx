import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildMetadata, getResolvedLocale } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  const t = await getTranslations({ locale: resolvedLocale, namespace: 'register' });
  const metaT = await getTranslations({ locale: resolvedLocale, namespace: 'metadata' });

  return buildMetadata({
    path: '/register',
    title: t('title'),
    description: metaT('description'),
    locale: resolvedLocale,
  });
}

export default async function RegisterLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return children;
}
