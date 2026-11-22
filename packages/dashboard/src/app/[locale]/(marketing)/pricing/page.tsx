import { ArrowUpRight } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';
import { buildMetadata, getResolvedLocale } from '@/lib/seo';
import { SummaryPanel } from './pricing-shell';
import { PricingCards, PricingSidebar } from './pricing-cards';

// Pricing 表数据来自 D1，build 阶段无绑定无法预渲染；模型快照由 unstable_cache 做天级缓存。
export const dynamic = 'force-dynamic';

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
            <div className="select-none space-y-4">
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
                prefetch={false}
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
