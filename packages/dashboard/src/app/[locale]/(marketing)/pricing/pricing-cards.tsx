import { ArrowUpRight } from '@phosphor-icons/react/ssr';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type Model } from '@/db/app-schema';
import { PROVIDER_DISPLAY, priceFormatter, providerStyles, tokenFormatter } from './pricing-data';
import { type ProviderSection, loadPricingSnapshot } from './pricing-snapshot';

export async function PricingSidebar({ locale }: { locale: string }) {
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

export async function PricingCards({ locale }: { locale: string }) {
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
        <div className="mt-4 grid select-none gap-4 text-sm leading-6 text-muted-foreground sm:grid-cols-3">
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
