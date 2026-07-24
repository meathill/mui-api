import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { buildMetadata, getResolvedLocale } from '@/lib/seo';
import { RouterLanding } from '../_components/router-landing';
import type { ToolEntry } from '../_components/tool-list-section';

// 不锚定单一竞品的全品类综述（对照 openrouter-alternatives 的差异化角度，见 DEV_NOTE）。
// MuiRouter 置顶，OpenRouter 这次作为普通条目之一收录进来。
const TOOL_ENTRIES: ToolEntry[] = [
  { id: 'muirouter', isMuiRouter: true },
  { id: 'openrouter', href: 'https://openrouter.ai/' },
  { id: 'litellm', href: 'https://www.litellm.ai/' },
  { id: 'portkey', href: 'https://portkey.ai/' },
  { id: 'cloudflareAiGateway', href: 'https://developers.cloudflare.com/ai-gateway/' },
];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  const t = await getTranslations({ locale: resolvedLocale, namespace: 'bestLlmGateway' });

  return buildMetadata({
    path: '/best-llm-gateway',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale: resolvedLocale,
  });
}

export default async function BestLlmGatewayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <RouterLanding
      namespace="bestLlmGateway"
      path="/best-llm-gateway"
      locale={locale}
      variant="toolList"
      toolEntries={TOOL_ENTRIES}
    />
  );
}
