import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildMetadata, getResolvedLocale } from '@/lib/seo';
import { RouterLanding } from '../_components/router-landing';
import type { ToolEntry } from '../_components/tool-list-section';

// 站外链接与是否 MuiRouter 自身是代码字面量，不进 i18n（改一次不用同步 8 个语言文件）；
// 说明文案走 i18n namespace.tools.<id>。MuiRouter 置顶。
const TOOL_ENTRIES: ToolEntry[] = [
  { id: 'muirouter', isMuiRouter: true },
  { id: 'litellm', href: 'https://www.litellm.ai/' },
  { id: 'portkey', href: 'https://portkey.ai/' },
  { id: 'cloudflareAiGateway', href: 'https://developers.cloudflare.com/ai-gateway/' },
];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  const t = await getTranslations({ locale: resolvedLocale, namespace: 'openrouterAlternatives' });

  return buildMetadata({
    path: '/openrouter-alternatives',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale: resolvedLocale,
  });
}

export default async function OpenrouterAlternativesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <RouterLanding
      namespace="openrouterAlternatives"
      path="/openrouter-alternatives"
      locale={locale}
      variant="toolList"
      toolEntries={TOOL_ENTRIES}
    />
  );
}
