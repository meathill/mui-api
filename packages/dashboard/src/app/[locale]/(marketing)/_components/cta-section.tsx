import { ArrowRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function CtaSection() {
  const t = useTranslations('cta');

  return (
    <section className="py-20 px-6 border-t border-border">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
          {t('description')}
          <br />
          {t('descriptionLine2')}
        </p>
        <div className="mt-8">
          <Link
            href="/register"
            className="press inline-flex h-12 items-center gap-2 rounded-lg border-2 border-[#3a2e23] bg-[var(--brand-yellow)] px-8 text-base font-semibold text-[#3a2e23] shadow-[0_3px_0_0_#3a2e23] hover:shadow-[0_4px_0_0_#3a2e23] active:shadow-[0_1px_0_0_#3a2e23]"
          >
            {t('button')}
            <ArrowRightIcon size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
