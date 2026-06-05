import { ArrowRightIcon, ArrowUpRightIcon, GaugeIcon, KeyRoundIcon, PlugZapIcon, RouteIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { getLocalizedPath, SITE_URL } from '@/lib/seo';

interface RouterFeature {
  title: string;
  description: string;
}

interface RouterFaq {
  question: string;
  answer: string;
}

interface RouterRelatedLink {
  href: string;
  label: string;
}

const FEATURE_ICONS = [RouteIcon, KeyRoundIcon, GaugeIcon, PlugZapIcon];

interface RouterLandingProps {
  /** i18n namespace holding this landing page's copy (e.g. 'aiRouter') */
  namespace: string;
  /** locale-agnostic route path (e.g. '/ai-router'), used for breadcrumb JSON-LD */
  path: string;
  locale: string;
}

/**
 * 复用型 SEO 落地页：支柱页 /ai-router 与各分簇页（/llm-router 等）共用同一结构，
 * 内容全部来自 i18n namespace，确保 8 语言一致；内联 FAQPage / BreadcrumbList 结构化数据。
 */
export function RouterLanding({ namespace, path, locale }: RouterLandingProps) {
  const t = useTranslations(namespace);
  const features = t.raw('features') as RouterFeature[];
  const faq = t.raw('faq') as RouterFaq[];
  const related = t.raw('related') as RouterRelatedLink[];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}${getLocalizedPath('/', locale)}` },
          {
            '@type': 'ListItem',
            position: 2,
            name: t('eyebrow'),
            item: `${SITE_URL}${getLocalizedPath(path, locale)}`,
          },
        ],
      },
    ],
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="bg-sun relative overflow-hidden px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="eyebrow mb-3">{t('eyebrow')}</p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl leading-tight">
            {t('title')}
            <span className="highlight">{t('titleHighlight')}</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">{t('intro')}</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="press inline-flex h-12 items-center gap-2 rounded-lg border-2 border-[#3a2e23] bg-[var(--brand-yellow)] px-8 text-base font-semibold text-[#3a2e23] shadow-[0_3px_0_0_#3a2e23] hover:shadow-[0_4px_0_0_#3a2e23] active:shadow-[0_1px_0_0_#3a2e23]"
            >
              {t('ctaPrimary')}
              <ArrowRightIcon size={18} />
            </Link>
            <Link
              href="/pricing"
              className="press-ink inline-flex h-12 items-center rounded-lg border-2 border-[var(--brand-ink)] bg-[var(--brand-cream)] px-8 text-base font-semibold text-[var(--brand-ink)]"
            >
              {t('ctaSecondary')}
            </Link>
          </div>
        </div>
      </section>

      <section className="py-14 px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-8">{t('featuresTitle')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((item, index) => {
              const Icon = FEATURE_ICONS[index % FEATURE_ICONS.length];
              return (
                <div key={item.title} className="flex gap-4 rounded-lg border border-border bg-card p-5">
                  <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-md bg-[var(--brand-fluff)] border border-[var(--brand-corgi)]">
                    <Icon size={20} className="text-[var(--brand-yellow-deep)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base mb-1.5">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-14 px-6 bg-muted/40">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight text-center mb-8">{t('faqTitle')}</h2>
          <dl className="space-y-6">
            {faq.map((item) => (
              <div key={item.question} className="rounded-lg border border-border bg-card p-5">
                <dt className="font-semibold text-base mb-2">{item.question}</dt>
                <dd className="text-sm text-muted-foreground leading-relaxed">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="py-14 px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight text-center mb-6">{t('relatedTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {related.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group inline-flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-[var(--brand-corgi)] hover:text-[var(--brand-yellow-deep)]"
              >
                {link.label}
                <ArrowUpRightIcon
                  size={16}
                  className="text-muted-foreground group-hover:text-[var(--brand-yellow-deep)]"
                />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-sun py-14 px-6 border-t border-border">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">{t('ctaTitle')}</h2>
          <p className="mt-3 text-lg text-muted-foreground leading-relaxed">{t('ctaDescription')}</p>
          <div className="mt-6">
            <Link
              href="/register"
              className="press inline-flex h-12 items-center gap-2 rounded-lg border-2 border-[#3a2e23] bg-[var(--brand-yellow)] px-8 text-base font-semibold text-[#3a2e23] shadow-[0_3px_0_0_#3a2e23] hover:shadow-[0_4px_0_0_#3a2e23] active:shadow-[0_1px_0_0_#3a2e23]"
            >
              {t('ctaButton')}
              <ArrowRightIcon size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
