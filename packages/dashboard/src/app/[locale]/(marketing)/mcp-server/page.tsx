import { ArrowUpRight } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { buildBreadcrumbEntity, buildFaqEntity } from '@/lib/json-ld';
import { buildMetadata, getResolvedLocale } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  const t = await getTranslations({ locale: resolvedLocale, namespace: 'mcpServer' });

  return buildMetadata({
    path: '/mcp-server',
    title: t('metaTitle'),
    description: t('metaDescription'),
    locale: resolvedLocale,
  });
}

interface McpServerTerm {
  term: string;
  definition: string;
}

interface McpServerFaqEntry {
  question: string;
  answer: string;
}

interface McpServerRelatedLink {
  href: string;
  label: string;
}

export default async function McpServerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'mcpServer' });
  const terms = t.raw('terms') as McpServerTerm[];
  const faq = t.raw('faq') as McpServerFaqEntry[];
  const supportItems = t.raw('supportItems') as string[];
  const limitations = t.raw('limitationsItems') as string[];
  const related = t.raw('related') as McpServerRelatedLink[];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [buildFaqEntity(faq), buildBreadcrumbEntity('/mcp-server', locale, t('eyebrow'))],
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="mb-10">
        <p className="text-sm font-medium text-primary mb-3">{t('eyebrow')}</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{t('title')}</h1>
        <p className="text-base text-muted-foreground leading-relaxed">{t('intro')}</p>
      </header>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('whatIsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">{t('whatIsBody')}</p>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('whenToUseTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">{t('whenToUseBody')}</p>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('terminologyTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {terms.map((item) => (
            <div key={item.term} className="border-l-2 border-primary/30 pl-4">
              <div className="font-mono text-sm font-medium mb-1">{item.term}</div>
              <p className="text-sm text-muted-foreground">{item.definition}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('muirouterTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">{t('muirouterBody')}</p>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('supportTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {supportItems.map((item, index) => (
            <p key={index}>• {item}</p>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-10">
        <CardHeader>
          <CardTitle>{t('limitationsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {limitations.map((item, index) => (
            <p key={index}>• {item}</p>
          ))}
          <p className="pt-2 text-xs text-muted-foreground/80">
            {t('lastUpdatedLabel')}: {t('lastUpdated')}
          </p>
        </CardContent>
      </Card>

      <section className="mb-10">
        <h2 className="text-xl font-semibold tracking-tight mb-4">{t('faqTitle')}</h2>
        <dl className="space-y-4">
          {faq.map((item) => (
            <div key={item.question} className="rounded-lg border border-border bg-card p-5">
              <dt className="font-semibold text-base mb-2">{item.question}</dt>
              <dd className="text-sm text-muted-foreground leading-relaxed">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-tight text-center mb-4">{t('relatedTitle')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
      </section>
    </div>
  );
}
