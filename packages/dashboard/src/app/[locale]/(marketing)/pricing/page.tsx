import { isGrokImageModelId } from '@muirouter/shared-db/grok-image';
import { asc } from 'drizzle-orm';
import { ArrowUpRight } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type Model, models } from '@/db/app-schema';
import { getDb } from '@/lib/db';
import { Link } from '@/i18n/navigation';
import { PRICING_MODELS_TAG, PUBLIC_CONTENT_REVALIDATE_SECONDS } from '@/lib/public-cache';
import { buildMetadata, getResolvedLocale } from '@/lib/seo';
import { SummaryPanel } from './pricing-shell';

// Pricing 表数据来自 D1，build 阶段无绑定无法预渲染；模型快照由 unstable_cache 做天级缓存。
export const dynamic = 'force-dynamic';

/**
 * Pricing 页面展示的 provider 范围与每家的官方来源 URL。
 * DB 中实际存在的 provider 若不在此列表（如 workers-ai 内部模型），不在公开 pricing 页展示。
 */
const PROVIDER_DISPLAY: Record<string, { label: string; sourceUrl: string }> = {
  openai: { label: 'OpenAI', sourceUrl: 'https://platform.openai.com/docs/pricing' },
  anthropic: { label: 'Anthropic', sourceUrl: 'https://www.anthropic.com/pricing' },
  deepseek: { label: 'DeepSeek', sourceUrl: 'https://api-docs.deepseek.com/quick_start/pricing' },
  moonshot: { label: 'Moonshot AI', sourceUrl: 'https://platform.moonshot.cn/docs/pricing' },
  grok: { label: 'xAI Grok', sourceUrl: 'https://docs.x.ai/docs/models' },
  zai: { label: 'Zhipu GLM', sourceUrl: 'https://bigmodel.cn/pricing' },
  qwen: { label: 'Qwen', sourceUrl: 'https://help.aliyun.com/zh/dashscope/developer-reference/model-pricing' },
  minimax: { label: 'MiniMax', sourceUrl: 'https://platform.minimaxi.com/document/price' },
  meta: { label: 'Meta', sourceUrl: 'https://www.llama.com/docs/pricing' },
  longcat: { label: 'LongCat', sourceUrl: 'https://longcat.chat/pricing' },
  hy: { label: 'HY', sourceUrl: 'https://hy.ai/pricing' },
  'google-ai-studio': { label: 'Gemini', sourceUrl: 'https://ai.google.dev/pricing' },
  'xiaomi-mimo': { label: 'Xiaomi MiMo', sourceUrl: 'https://api.xiaomimimo.com/pricing' },
  'workers-ai': { label: 'Workers AI', sourceUrl: 'https://developers.cloudflare.com/workers-ai/models/' },
};

const PROVIDER_ORDER = [
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

const providerStyles: Record<
  string,
  {
    badgeClassName: string;
    surfaceClassName: string;
    borderClassName: string;
  }
> = {
  openai: {
    badgeClassName:
      'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-300',
    surfaceClassName: 'bg-emerald-500/5 dark:bg-emerald-500/10',
    borderClassName: 'from-emerald-500/70 via-emerald-400/20 to-transparent',
  },
  anthropic: {
    badgeClassName:
      'border-orange-500/20 bg-orange-500/10 text-orange-700 dark:border-orange-400/30 dark:bg-orange-500/20 dark:text-orange-300',
    surfaceClassName: 'bg-orange-500/5 dark:bg-orange-500/10',
    borderClassName: 'from-orange-500/70 via-orange-400/20 to-transparent',
  },
  'google-ai-studio': {
    badgeClassName:
      'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/20 dark:text-blue-300',
    surfaceClassName: 'bg-blue-500/5 dark:bg-blue-500/10',
    borderClassName: 'from-blue-500/70 via-sky-400/20 to-transparent',
  },
  moonshot: {
    badgeClassName:
      'border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:border-cyan-400/30 dark:bg-cyan-500/20 dark:text-cyan-300',
    surfaceClassName: 'bg-cyan-500/5 dark:bg-cyan-500/10',
    borderClassName: 'from-cyan-500/70 via-cyan-400/20 to-transparent',
  },
  'xiaomi-mimo': {
    badgeClassName:
      'border-purple-500/20 bg-purple-500/10 text-purple-700 dark:border-purple-400/30 dark:bg-purple-500/20 dark:text-purple-300',
    surfaceClassName: 'bg-purple-500/5 dark:bg-purple-500/10',
    borderClassName: 'from-purple-500/70 via-purple-400/20 to-transparent',
  },
  grok: {
    badgeClassName:
      'border-slate-500/20 bg-slate-500/10 text-slate-700 dark:border-slate-400/30 dark:bg-slate-500/20 dark:text-slate-300',
    surfaceClassName: 'bg-slate-500/5 dark:bg-slate-500/10',
    borderClassName: 'from-slate-500/70 via-slate-400/20 to-transparent',
  },
  deepseek: {
    badgeClassName:
      'border-blue-500/20 bg-blue-500/10 text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/20 dark:text-blue-300',
    surfaceClassName: 'bg-blue-500/5 dark:bg-blue-500/10',
    borderClassName: 'from-blue-500/70 via-sky-400/20 to-transparent',
  },
  zai: {
    badgeClassName:
      'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:border-violet-400/30 dark:bg-violet-500/20 dark:text-violet-300',
    surfaceClassName: 'bg-violet-500/5 dark:bg-violet-500/10',
    borderClassName: 'from-violet-500/70 via-violet-400/20 to-transparent',
  },
  qwen: {
    badgeClassName:
      'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/20 dark:text-amber-300',
    surfaceClassName: 'bg-amber-500/5 dark:bg-amber-500/10',
    borderClassName: 'from-amber-500/70 via-amber-400/20 to-transparent',
  },
  minimax: {
    badgeClassName:
      'border-teal-500/20 bg-teal-500/10 text-teal-700 dark:border-teal-400/30 dark:bg-teal-500/20 dark:text-teal-300',
    surfaceClassName: 'bg-teal-500/5 dark:bg-teal-500/10',
    borderClassName: 'from-teal-500/70 via-teal-400/20 to-transparent',
  },
  meta: {
    badgeClassName:
      'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:border-sky-400/30 dark:bg-sky-500/20 dark:text-sky-300',
    surfaceClassName: 'bg-sky-500/5 dark:bg-sky-500/10',
    borderClassName: 'from-sky-500/70 via-sky-400/20 to-transparent',
  },
  longcat: {
    badgeClassName:
      'border-pink-500/20 bg-pink-500/10 text-pink-700 dark:border-pink-400/30 dark:bg-pink-500/20 dark:text-pink-300',
    surfaceClassName: 'bg-pink-500/5 dark:bg-pink-500/10',
    borderClassName: 'from-pink-500/70 via-pink-400/20 to-transparent',
  },
  hy: {
    badgeClassName:
      'border-lime-500/20 bg-lime-500/10 text-lime-700 dark:border-lime-400/30 dark:bg-lime-500/20 dark:text-lime-300',
    surfaceClassName: 'bg-lime-500/5 dark:bg-lime-500/10',
    borderClassName: 'from-lime-500/70 via-lime-400/20 to-transparent',
  },
  'workers-ai': {
    badgeClassName:
      'border-zinc-500/20 bg-zinc-500/10 text-zinc-700 dark:border-zinc-400/30 dark:bg-zinc-500/20 dark:text-zinc-300',
    surfaceClassName: 'bg-zinc-500/5 dark:bg-zinc-500/10',
    borderClassName: 'from-zinc-500/70 via-zinc-400/20 to-transparent',
  },
};

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

const tokenFormatter = new Intl.NumberFormat('en-US');

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  const t = await getTranslations({ locale: resolvedLocale, namespace: 'pricing.metadata' });

  return buildMetadata({
    path: '/pricing',
    title: t('title'),
    description: t('description'),
    locale: resolvedLocale,
  });
}

interface ProviderSection {
  provider: string;
  models: Model[];
}

interface PricingSnapshot {
  sections: ProviderSection[];
  generatedAt: string;
}

async function queryPricingSnapshot(): Promise<PricingSnapshot> {
  const db = await getDb();
  const rows = await db.select().from(models).orderBy(asc(models.id));

  // 只展示在 PROVIDER_DISPLAY 名单内、且至少有 input 价的模型；过滤 TTS / 图片这类按次计价模型
  const grouped = new Map<string, Model[]>();
  for (const row of rows) {
    if (!(row.provider in PROVIDER_DISPLAY)) continue;
    if ((row.inputPrice ?? 0) <= 0 && (row.outputPrice ?? 0) <= 0) continue;
    // Grok 图片模型的 outputPrice 是内部 token 汇率，不是真实公开 token 单价。
    if (isGrokImageModelId(row.id)) continue;
    const list = grouped.get(row.provider) ?? [];
    list.push(row);
    grouped.set(row.provider, list);
  }

  return {
    sections: PROVIDER_ORDER.filter((provider) => grouped.has(provider)).map((provider) => ({
      provider,
      models: grouped.get(provider) ?? [],
    })),
    generatedAt: new Date().toISOString().slice(0, 10),
  };
}

const loadPricingSnapshot = unstable_cache(queryPricingSnapshot, ['pricing-snapshot'], {
  revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
  tags: [PRICING_MODELS_TAG],
});

// 不加 Suspense 外壳：一旦外壳先 flush，D1 出错时响应就是 200 + 骨架屏，
// 爬虫会把这种薄内容当正常页面收录。宁可整页 500，也不要 soft 200。
export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'pricing' });

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[-8rem] top-0 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-[-6rem] top-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-[28rem] bg-gradient-to-b from-muted/40 via-background to-background" />
      </div>

      <section className="border-b border-border/70">
        <div className="container mx-auto grid gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[minmax(0,1.15fr)_20rem] lg:items-start">
          <div className="space-y-6">
            <Badge variant="outline" className="w-fit">
              {t('eyebrow')}
            </Badge>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">{t('title')}</h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{t('subtitle')}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryPanel
                title={t('summary.noSubscriptionTitle')}
                description={t('summary.noSubscriptionDescription')}
              />
              <SummaryPanel title={t('summary.officialTitle')} description={t('summary.officialDescription')} />
              <SummaryPanel
                title={t('summary.unitTitle')}
                description={t('summary.unitDescription', { unit: t('unit') })}
              />
            </div>
          </div>

          <PricingSidebar locale={locale} />
        </div>
      </section>

      <section className="container mx-auto px-6 py-12 sm:py-16">
        <PricingCards locale={locale} />

        <div className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight text-center mb-6">{t('relatedTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(t.raw('related') as Array<{ href: string; label: string }>).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group inline-flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-[var(--brand-corgi)] hover:text-[var(--brand-yellow-deep)]"
              >
                {link.label}
                <ArrowUpRight size={16} className="text-muted-foreground group-hover:text-[var(--brand-yellow-deep)]" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

async function PricingSidebar({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'pricing' });
  const { sections, generatedAt } = await loadPricingSnapshot();

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border/80 bg-card/90 p-5 shadow-sm backdrop-blur">
        <p className="text-sm font-medium text-foreground">{t('updatedAtLabel')}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{generatedAt}</p>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t('actualBillingNotice')}</p>
      </div>

      <div className="rounded-3xl border border-border/70 bg-background/85 p-5">
        <p className="text-sm font-medium text-foreground">{t('sourceLabel')}</p>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          {sections.map((section) => {
            const display = PROVIDER_DISPLAY[section.provider];
            return (
              <li key={section.provider}>
                <a
                  href={display.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  {display.label}
                  <ArrowUpRight size={14} />
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

async function PricingCards({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'pricing' });
  const { sections, generatedAt } = await loadPricingSnapshot();

  return (
    <>
      <div className="space-y-8">
        {sections.map((section) => (
          <ProviderPricingCard key={section.provider} section={section} locale={locale} />
        ))}
      </div>

      <div className="mt-10 rounded-3xl border border-border/80 bg-muted/30 p-6 sm:p-8">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{t('notesTitle')}</h2>
        <div className="mt-4 grid gap-4 text-sm leading-6 text-muted-foreground sm:grid-cols-3">
          <p>{t('scopeNotice')}</p>
          <p>{t('referenceNotice', { date: generatedAt })}</p>
          <p>{t('billingNotice')}</p>
        </div>
      </div>
    </>
  );
}

async function ProviderPricingCard({ section, locale }: { section: ProviderSection; locale: string }) {
  const t = await getTranslations({ locale, namespace: 'pricing' });
  const styles = providerStyles[section.provider] ?? providerStyles.openai;
  const display = PROVIDER_DISPLAY[section.provider];

  return (
    <Card className="overflow-hidden border-border/80">
      <div className={`h-1 w-full bg-gradient-to-r ${styles.borderClassName}`} />
      <CardHeader className="gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Badge variant="outline" className={styles.badgeClassName}>
            {display.label}
          </Badge>
          <div className="space-y-2">
            <CardTitle className="text-2xl">{display.label}</CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-6">
              {t.has(`providers.${section.provider}`) ? t(`providers.${section.provider}`) : ''}
            </CardDescription>
          </div>
        </div>

        <a
          href={display.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-primary"
        >
          {t('officialSource')}
          <ArrowUpRight size={15} />
        </a>
      </CardHeader>

      <CardContent className="pt-6">
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.modelId')}</TableHead>
                <TableHead className="text-right">{t('columns.input')}</TableHead>
                <TableHead className="text-right">{t('columns.cachedInput')}</TableHead>
                <TableHead className="text-right">{t('columns.output')}</TableHead>
                <TableHead className="w-[24rem]">{t('columns.notes')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {section.models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell className="whitespace-normal align-top font-mono text-xs text-muted-foreground">
                    {model.id}
                  </TableCell>
                  <TableCell className="text-right align-top font-medium text-foreground">
                    {formatPrice(model.inputPrice)}
                  </TableCell>
                  <TableCell className="text-right align-top text-muted-foreground">
                    {formatPrice(model.cachedInputPrice)}
                  </TableCell>
                  <TableCell className="text-right align-top font-medium text-foreground">
                    {formatPrice(model.outputPrice)}
                  </TableCell>
                  <TableCell className={`whitespace-normal align-top text-sm leading-6 ${styles.surfaceClassName}`}>
                    <div className="rounded-xl px-3 py-2 text-muted-foreground">{getDynamicNote(t, model)}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 md:hidden">
          {section.models.map((model) => (
            <div key={model.id} className={`rounded-2xl border border-border/70 p-4 ${styles.surfaceClassName}`}>
              <div className="space-y-1">
                <p className="font-mono text-xs text-muted-foreground">{model.id}</p>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <PriceField label={t('columns.input')} value={formatPrice(model.inputPrice)} />
                <PriceField label={t('columns.cachedInput')} value={formatPrice(model.cachedInputPrice)} />
                <PriceField label={t('columns.output')} value={formatPrice(model.outputPrice)} />
                <PriceField label={t('columns.notes')} value={getDynamicNote(t, model)} />
              </dl>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PriceField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium leading-6 text-foreground">{value}</dd>
    </div>
  );
}

function formatPrice(value: number | null): string {
  if (value == null) {
    return '-';
  }

  return priceFormatter.format(value);
}

function getDynamicNote(t: Awaited<ReturnType<typeof getTranslations>>, model: Model): string {
  if (model.longContextThresholdTokens == null) {
    return t('notes.none');
  }
  return t('notes.longContextDynamic', {
    threshold: tokenFormatter.format(model.longContextThresholdTokens),
    input: formatPrice(model.longContextInputPrice ?? null),
    cached: formatPrice(model.longContextCachedInputPrice ?? null),
    output: formatPrice(model.longContextOutputPrice ?? null),
  });
}
