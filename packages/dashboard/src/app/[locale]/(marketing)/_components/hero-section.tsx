import { useTranslations } from 'next-intl';
import { ArrowRightIcon } from 'lucide-react';
import { Link } from '@/i18n/navigation';

export function HeroSection() {
  const t = useTranslations('hero');

  const stats = [
    { value: t('stat1Value'), label: t('stat1Label') },
    { value: t('stat2Value'), label: t('stat2Label') },
    { value: t('stat3Value'), label: t('stat3Label') },
    { value: t('stat4Value'), label: t('stat4Label') },
  ];

  return (
    <section className="relative overflow-hidden py-24 px-6 sm:py-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse" />
          {t('badge')}
        </div>

        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl leading-tight">
          {t('title')}
          <span className="text-primary">{t('titleHighlight')}</span>
        </h1>

        <p className="mt-6 text-lg text-muted-foreground leading-relaxed sm:text-xl max-w-2xl mx-auto">
          {t('description')}
          <br className="hidden sm:block" />
          {t('descriptionLine2')}
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t('ctaPrimary')}
            <ArrowRightIcon size={18} />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex h-12 items-center rounded-lg border border-border px-8 text-base font-medium hover:bg-accent transition-colors"
          >
            {t('ctaSecondary')}
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
