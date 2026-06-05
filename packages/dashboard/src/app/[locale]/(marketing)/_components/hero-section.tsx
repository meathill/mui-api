import { ArrowRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PawIcon } from '@/components/brand/paw-icon';
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
    <section className="bg-sun relative overflow-hidden px-6 py-16 sm:py-20">
      {/* 角落爪印装饰 */}
      <PawIcon className="wiggle pointer-events-none absolute left-[6%] top-[18%] hidden size-12 text-[var(--brand-corgi)]/45 sm:block" />
      <PawIcon className="pointer-events-none absolute right-[5%] top-[60%] hidden size-10 -rotate-12 text-[var(--brand-corgi)]/35 sm:block" />

      <div className="mx-auto max-w-4xl text-center">
        <p className="eyebrow mb-3">{t('badge')}</p>

        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl leading-tight">
          {t('title')}
          <span className="highlight">{t('titleHighlight')}</span>
        </h1>

        <p className="mt-4 text-lg text-muted-foreground leading-relaxed sm:text-xl max-w-2xl mx-auto">
          {t('description')}
          <br className="hidden sm:block" />
          {t('descriptionLine2')}
        </p>

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

        <div className="mt-4">
          <Link
            href="/ai-router"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('ctaLearn')}
            <ArrowRightIcon size={14} />
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div key={stat.label}>
              <div className="font-heading text-3xl font-bold tracking-tight text-[var(--brand-yellow-deep)]">
                {stat.value}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
