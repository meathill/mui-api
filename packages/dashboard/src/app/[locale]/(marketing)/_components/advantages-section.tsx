import { ArrowLeftRightIcon, CodeIcon, GlobeIcon, WalletIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function AdvantagesSection() {
  const t = useTranslations('advantages');

  const advantages = [
    { icon: GlobeIcon, title: t('noVpnTitle'), description: t('noVpnDesc') },
    { icon: WalletIcon, title: t('payPerUseTitle'), description: t('payPerUseDesc') },
    { icon: CodeIcon, title: t('compatibleTitle'), description: t('compatibleDesc') },
    { icon: ArrowLeftRightIcon, title: t('passthroughTitle'), description: t('passthroughDesc') },
  ];

  return (
    <section className="py-20 px-6 bg-muted/30">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="mt-3 text-muted-foreground text-lg">{t('subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {advantages.map((item) => (
            <div key={item.title} className="flex gap-4 rounded-xl border border-border bg-card p-6">
              <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <item.icon size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1.5">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
