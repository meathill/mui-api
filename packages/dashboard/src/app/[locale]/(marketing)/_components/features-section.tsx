import { Gauge, Key, Path, Plug } from '@phosphor-icons/react/ssr';

export interface RouterFeature {
  title: string;
  description: string;
}

interface FeaturesSectionProps {
  title: string;
  features: RouterFeature[];
}

const FEATURE_ICONS = [Path, Key, Gauge, Plug];

/** 4 图标特性网格：从 router-landing.tsx 抽出，供 RouterLanding 的 features variant 使用 */
export function FeaturesSection({ title, features }: FeaturesSectionProps) {
  return (
    <section className="py-14 px-6">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-3xl font-bold tracking-tight text-center mb-8">{title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((item, index) => {
            const Icon = FEATURE_ICONS[index % FEATURE_ICONS.length];
            return (
              <div key={item.title} className="flex gap-4 rounded-lg border border-border bg-card p-5">
                <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-md bg-[var(--brand-fluff)] border border-[var(--brand-corgi)]">
                  <Icon size={20} className="text-[var(--brand-yellow-deep)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-base mb-1.5">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
