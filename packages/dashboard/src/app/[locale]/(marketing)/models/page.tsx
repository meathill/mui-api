import { asc } from 'drizzle-orm';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { type Model, models } from '@/db/app-schema';
import { getDb } from '@/lib/db';
import { PRICING_MODELS_TAG, PUBLIC_CONTENT_REVALIDATE_SECONDS } from '@/lib/public-cache';
import { buildMetadata, getResolvedLocale } from '@/lib/seo';
import { ModelsCatalog } from './models-catalog';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  return buildMetadata({
    path: '/models',
    title: resolvedLocale === 'zh' ? '全量模型列表' : 'All Models',
    description:
      resolvedLocale === 'zh'
        ? 'MuiRouter 支持的全部模型，按厂商分组，含原厂定价与上下文信息。'
        : 'Full catalog of models supported by MuiRouter, grouped by provider with list pricing.',
    locale: resolvedLocale,
  });
}

interface ProviderSection {
  provider: string;
  models: Model[];
}

async function queryAllModels(): Promise<ProviderSection[]> {
  const db = await getDb();
  const rows = await db.select().from(models).orderBy(asc(models.id));
  const grouped = new Map<string, Model[]>();
  for (const row of rows) {
    const list = grouped.get(row.provider) ?? [];
    list.push(row);
    grouped.set(row.provider, list);
  }
  const order = [
    'openai',
    'anthropic',
    'deepseek',
    'moonshot',
    'grok',
    'zai',
    'qwen',
    'minimax',
    'meta',
    'longcat',
    'hy',
    'google-ai-studio',
    'xiaomi-mimo',
    'workers-ai',
  ];
  const sortedProviders = [...grouped.keys()].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return sortedProviders.map((provider) => ({
    provider,
    models: grouped.get(provider) ?? [],
  }));
}

const loadAllModels = unstable_cache(queryAllModels, ['models-catalog'], {
  revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
  tags: [PRICING_MODELS_TAG],
});

export default async function ModelsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'models' });
  const sections = await loadAllModels();
  const total = sections.reduce((acc, s) => acc + s.models.length, 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{locale === 'zh' ? '全量模型' : 'All Models'}</h1>
        <p className="mt-2 text-muted-foreground">
          {locale === 'zh'
            ? `共 ${total} 个模型，按厂商分组。首页仅展示 9 家精选，此处为完整工具列表。按原厂价计费，系数为 1。`
            : `Total ${total} models grouped by provider. Homepage shows 9 featured providers; this is the full tool list. Billed at list price (x1).`}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{t('footnote')}</p>
      </div>
      <ModelsCatalog sections={sections} />
    </div>
  );
}
