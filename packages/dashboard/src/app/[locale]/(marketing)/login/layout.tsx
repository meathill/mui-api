import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildMetadata, getResolvedLocale } from '@/lib/seo';

// 登录页必须 request-time 渲染：静态预渲染会被 Next/OpenNext 标成 `s-maxage=31536000`，
// 一旦 CF 缓存规则生效就会把带 Set-Cookie 的登录页共享缓存一年。
// force-dynamic 后响应头为 `private, no-cache, no-store, max-age=0, must-revalidate`。
export const dynamic = 'force-dynamic';

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
