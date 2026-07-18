import { isGrokImageModelId } from '@muirouter/shared-db/grok-image';
import { asc } from 'drizzle-orm';
import { ArrowUpRight } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type Model, models } from '@/db/app-schema';
import { getDb } from '@/lib/db';
import { buildMetadata, getResolvedLocale } from '@/lib/seo';

// Pricing 表数据来自 D1，build 阶段无绑定无法预渲染；运行时由 CF 边缘缓存兜底
// （Worker 层 + 浏览器层都可加 cache-control 头）。
export const dynamic = 'force-dynamic';

/**
 * Pricing 页面展示的 provider 范围与每家的官方来源 URL。
 * DB 中实际存在的 provider 若不在此列表（如 workers-ai 内部模型），不在公开 pricing 页展示。
 */
const PROVIDER_DISPLAY: Record<string, { label: string; sourceUrl: string }> = {
  openai: { label: 'OpenAI', sourceUrl: 'https://developers.openai.com/api/docs/pricing' },
  anthropic: { label: 'Anthropic', sourceUrl: 'https://www.anthropic.com/pricing' },
  'google-ai-studio': { label: 'Gemini', sourceUrl: 'https://ai.google.dev/pricing' },
  moonshot: { label: 'Moonshot AI', sourceUrl: 'https://platform.kimi.ai/docs/pricing/chat-k3' },
  'xiaomi-mimo': { label: 'Xiaomi MiMo', sourceUrl: 'https://api.xiaomimimo.com/pricing' },
  grok: { label: 'xAI Grok', sourceUrl: 'https://x.ai/api' },
};

const PROVIDER_ORDER = ['openai', 'anthropic', 'google-ai-studio', 'moonshot', 'xiaomi-mimo', 'grok'];

const providerStyles: Record<
  string,
  {
    badgeClassName: string;
    surfaceClassName: string;
    borderClassName: string;
  }
> = {
  openai: {
    badgeClassName: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
    surfaceClassName: 'bg-emerald-500/5',
    borderClassName: 'from-emerald-500/70 via-emerald-400/20 to-transparent',
  },
  anthropic: {
    badgeClassName: 'border-orange-500/20 bg-orange-500/10 text-orange-700',
    surfaceClassName: 'bg-orange-500/5',
    borderClassName: 'from-orange-500/70 via-orange-400/20 to-transparent',
  },
  'google-ai-studio': {
    badgeClassName: 'border-blue-500/20 bg-blue-500/10 text-blue-700',
    surfaceClassName: 'bg-blue-500/5',
    borderClassName: 'from-blue-500/70 via-sky-400/20 to-transparent',
  },
  moonshot: {
    badgeClassName: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-700',
    surfaceClassName: 'bg-cyan-500/5',
    borderClassName: 'from-cyan-500/70 via-cyan-400/20 to-transparent',
  },
  'xiaomi-mimo': {
    badgeClassName: 'border-purple-500/20 bg-purple-500/10 text-purple-700',
    surfaceClassName: 'bg-purple-500/5',
    borderClassName: 'from-purple-500/70 via-purple-400/20 to-transparent',
  },
  grok: {
    badgeClassName: 'border-slate-500/20 bg-slate-500/10 text-slate-700',
    surfaceClassName: 'bg-slate-500/5',
    borderClassName: 'from-slate-500/70 via-slate-400/20 to-transparent',
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

async function loadPricingSections(): Promise<ProviderSection[]> {
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

  return PROVIDER_ORDER.filter((p) => grouped.has(p)).map((provider) => ({
    provider,
    models: grouped.get(provider) ?? [],
  }));
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'pricing' });
  const sections = await loadPricingSections();
  const updatedAt = new Date().toISOString().slice(0, 10);

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[-8rem] top-0 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-[-6rem] top-40 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-[28rem] bg-gradient-to-b from-muted/40 via-background to-background" />
      </div>

      <section className="border-b border-border/70">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:py-20 lg:grid-cols-[minmax(0,1.15fr)_20rem] lg:items-start">
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

          <div className="space-y-4">
            <div className="rounded-3xl border border-border/80 bg-card/90 p-5 shadow-sm backdrop-blur">
              <p className="text-sm font-medium text-foreground">{t('updatedAtLabel')}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{updatedAt}</p>
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
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <div className="space-y-8">
          {sections.map((section) => (
            <ProviderPricingCard key={section.provider} section={section} locale={locale} />
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-border/80 bg-muted/30 p-6 sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{t('notesTitle')}</h2>
          <div className="mt-4 grid gap-4 text-sm leading-6 text-muted-foreground sm:grid-cols-3">
            <p>{t('scopeNotice')}</p>
            <p>{t('referenceNotice', { date: updatedAt })}</p>
            <p>{t('billingNotice')}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
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
