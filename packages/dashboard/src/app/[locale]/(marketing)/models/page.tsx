import { asc } from 'drizzle-orm';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { type Model, models } from '@/db/app-schema';
import { getDb } from '@/lib/db';
import { PRICING_MODELS_TAG, PUBLIC_CONTENT_REVALIDATE_SECONDS } from '@/lib/public-cache';
import { getBilingualPageMeta } from '@/lib/page-meta';
import { buildMetadata, BILINGUAL_CONTENT_LOCALES, getResolvedLocale } from '@/lib/seo';
import { ModelsCatalog } from './models-catalog';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  return buildMetadata({
    path: '/models',
    ...getBilingualPageMeta('models', resolvedLocale),
    locale: resolvedLocale,
    // 页面文案只有中英两套：其余语言页 canonical 指向英文版。
    translations: BILINGUAL_CONTENT_LOCALES,
  });
}

interface ProviderSection {
  provider: string;
  models: Model[];
}

function getModelUpdateDate(model: Model): string {
  if (model.metadataJson) {
    try {
      const parsed = JSON.parse(model.metadataJson);
      if (typeof parsed?.lastUpdated === 'string') return parsed.lastUpdated;
      if (typeof parsed?.releaseDate === 'string') return parsed.releaseDate;
    } catch {
      // 忽略非法 JSON
    }
  }
  return '';
}

function compareModelsByUpdateOrderDesc(a: Model, b: Model): number {
  const dateA = getModelUpdateDate(a);
  const dateB = getModelUpdateDate(b);
  if (dateA && dateB && dateA !== dateB) {
    return dateB.localeCompare(dateA);
  }
  if (dateA && !dateB) return -1;
  if (!dateA && dateB) return 1;
  return a.id.localeCompare(b.id);
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

  // 每个厂商内的模型按更新顺序倒序排（最新发布的排前面）
  for (const list of grouped.values()) {
    list.sort(compareModelsByUpdateOrderDesc);
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

  const getProviderLatestDate = (provider: string): string => {
    const list = grouped.get(provider) ?? [];
    return list.reduce((latest, m) => {
      const d = getModelUpdateDate(m);
      return d > latest ? d : latest;
    }, '');
  };

  // 厂商分组也优先按最新模型发布时间倒序，相同时按主流度预设顺序排序
  const sortedProviders = [...grouped.keys()].sort((a, b) => {
    const dateA = getProviderLatestDate(a);
    const dateB = getProviderLatestDate(b);
    if (dateA && dateB && dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;
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

const loadAllModels = unstable_cache(queryAllModels, ['models-catalog-v2'], {
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
    <div className="container mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{locale === 'zh' ? '全量模型' : 'All Models'}</h1>
        <p className="mt-2 text-muted-foreground">
          {locale === 'zh'
            ? `共 ${total} 个模型，按厂商分组，按更新顺序倒序排列。首页仅展示 9 家精选，此处为完整工具列表。按原厂价计费，系数为 1。`
            : `Total ${total} models grouped by provider, sorted by update date in descending order. Homepage shows 9 featured providers; this is the full tool list. Billed at list price (x1).`}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{t('footnote')}</p>
      </div>
      <ModelsCatalog sections={sections} locale={locale} />
    </div>
  );
}
