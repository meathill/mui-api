import { ArrowRight, ArrowUpRight } from '@phosphor-icons/react/ssr';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { buildBreadcrumbEntity, buildFaqEntity, buildItemListEntity } from '@/lib/json-ld';
import { ComparisonTableSection, type ComparisonRow } from './comparison-table-section';
import { FeaturesSection, type RouterFeature } from './features-section';
import { ToolListSection, type ToolCopy, type ToolEntry } from './tool-list-section';

interface RouterFaq {
  question: string;
  answer: string;
}

interface RouterRelatedLink {
  href: string;
  label: string;
}

interface RouterLandingProps {
  /** i18n namespace holding this landing page's copy (e.g. 'aiRouter') */
  namespace: string;
  /** locale-agnostic route path (e.g. '/ai-router'), used for breadcrumb JSON-LD */
  path: string;
  locale: string;
  /** 中段主内容区形态，默认 'features'（4 图标网格）；对比页传 'comparisonTable'，榜单页传 'toolList' */
  variant?: 'features' | 'comparisonTable' | 'toolList';
  /** 仅 comparisonTable 用：列名是专有名词（如 'MuiRouter'/'OpenRouter'），不进 i18n */
  comparisonColumns?: string[];
  /** 仅 comparisonTable 用：高亮哪一列，默认第 0 列（通常是 MuiRouter 自己） */
  highlightColumnIndex?: number;
  /** 仅 toolList 用：榜单条目，id/href/isMuiRouter 是代码字面量，文案走 i18n tools.<id> */
  toolEntries?: ToolEntry[];
}

/**
 * 复用型 SEO 落地页：支柱页 /ai-router 与各分簇页（/llm-router 等）共用同一结构，
 * 内容全部来自 i18n namespace，确保 8 语言一致；内联 FAQPage / BreadcrumbList 结构化数据。
 */
export function RouterLanding({
  namespace,
  path,
  locale,
  variant = 'features',
  comparisonColumns,
  highlightColumnIndex = 0,
  toolEntries,
}: RouterLandingProps) {
  const t = useTranslations(namespace);
  const faq = t.raw('faq') as RouterFaq[];
  const related = t.raw('related') as RouterRelatedLink[];
  const toolsCopy = variant === 'toolList' ? (t.raw('tools') as Record<string, ToolCopy>) : undefined;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      buildFaqEntity(faq),
      buildBreadcrumbEntity(path, locale, t('eyebrow')),
      ...(variant === 'toolList' && toolEntries && toolsCopy
        ? [
            buildItemListEntity(
              toolEntries.map((entry) => ({
                name: toolsCopy[entry.id].name,
                url: entry.isMuiRouter ? undefined : entry.href,
              })),
            ),
          ]
        : []),
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
              <ArrowRight size={18} />
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

      {variant === 'comparisonTable' && comparisonColumns ? (
        <ComparisonTableSection
          title={t('featuresTitle')}
          columns={comparisonColumns}
          rows={t.raw('comparisonRows') as ComparisonRow[]}
          highlightColumnIndex={highlightColumnIndex}
        />
      ) : variant === 'toolList' && toolEntries && toolsCopy ? (
        <ToolListSection title={t('featuresTitle')} entries={toolEntries} copy={toolsCopy} />
      ) : (
        <FeaturesSection title={t('featuresTitle')} features={t.raw('features') as RouterFeature[]} />
      )}

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
                <ArrowUpRight size={16} className="text-muted-foreground group-hover:text-[var(--brand-yellow-deep)]" />
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
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
