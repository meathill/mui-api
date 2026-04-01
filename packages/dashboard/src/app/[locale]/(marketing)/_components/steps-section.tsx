import { useTranslations } from 'next-intl';
import { UserPlusIcon, CreditCardIcon, RocketIcon } from 'lucide-react';

export function StepsSection() {
  const t = useTranslations('steps');

  const steps = [
    { icon: UserPlusIcon, step: '01', title: t('step1Title'), description: t('step1Desc') },
    { icon: CreditCardIcon, step: '02', title: t('step2Title'), description: t('step2Desc') },
    { icon: RocketIcon, step: '03', title: t('step3Title'), description: t('step3Desc') },
  ];

  return (
    <section className="py-20 px-6 border-t border-border">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="mt-3 text-muted-foreground text-lg">{t('subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((item) => (
            <div key={item.step} className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
                <item.icon size={24} className="text-primary" />
              </div>
              <div className="text-xs font-mono text-muted-foreground mb-2">STEP {item.step}</div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
