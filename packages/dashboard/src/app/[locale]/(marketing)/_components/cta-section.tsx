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
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t('button')}
            <ArrowRightIcon size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
