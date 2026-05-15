import { CreditCardIcon, RocketIcon, UserPlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function StepsSection() {
  const t = useTranslations('steps');

  const steps = [
    { icon: UserPlusIcon, step: '01', title: t('step1Title'), description: t('step1Desc') },
    { icon: CreditCardIcon, step: '02', title: t('step2Title'), description: t('step2Desc') },
    { icon: RocketIcon, step: '03', title: t('step3Title'), description: t('step3Desc') },
  ];

  return (
    <section className="py-14 px-6 border-t border-border">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="mt-3 text-muted-foreground text-lg">{t('subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((item) => (
            <div key={item.step} className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-yellow)] border-2 border-[#3a2e23] shadow-[0_3px_0_0_#3a2e23] mb-4">
                <item.icon size={24} className="text-[#3a2e23]" />
              </div>
              <div className="eyebrow mb-2">STEP {item.step}</div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
