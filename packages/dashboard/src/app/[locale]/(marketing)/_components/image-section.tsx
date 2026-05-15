import { ImageIcon, LayersIcon, UploadIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function ImageSection() {
  const t = useTranslations('image');

  const items = [
    { icon: ImageIcon, title: t('generateTitle'), description: t('generateDesc') },
    { icon: UploadIcon, title: t('editTitle'), description: t('editDesc') },
    { icon: LayersIcon, title: t('workflowTitle'), description: t('workflowDesc') },
  ];

  return (
    <section className="border-t border-border px-6 py-14">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="eyebrow">{t('eyebrow')}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">{t('subtitle')}</p>
          <div className="mt-5 rounded-md border border-border bg-[var(--brand-fluff)] px-4 py-3 font-mono text-xs text-[var(--brand-yellow-deep)]">
            <p>POST /v1/images/generations</p>
            <p>POST /v1/images/edits</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {items.map((item) => (
            <div key={item.title} className="flex gap-4 rounded-lg border border-border bg-card p-5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[var(--brand-fluff)] border border-[var(--brand-corgi)]">
                <item.icon className="size-5 text-[var(--brand-yellow-deep)]" />
              </div>
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
