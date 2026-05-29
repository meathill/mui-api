import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildMetadata, getResolvedLocale } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  const t = await getTranslations({ locale: resolvedLocale, namespace: 'login' });
  const metaT = await getTranslations({ locale: resolvedLocale, namespace: 'metadata' });

  // 登录页 noindex：账号入口对搜索引擎无价值，sitemap.ts 也已移除 /login。
  return buildMetadata({
    path: '/login',
    title: t('title'),
    description: metaT('description'),
    locale: resolvedLocale,
    noindex: true,
  });
}

export default async function LoginLayout({
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
