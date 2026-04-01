import { useTranslations } from 'next-intl';

export function ModelsSection() {
  const t = useTranslations('models');

  const providers = [
    {
      name: 'OpenAI',
      color: 'bg-emerald-500/10 text-emerald-600',
      models: ['GPT-5.4', 'GPT-5.3-codex', 'GPT-5.4-mini'],
      description: t('openaiDesc'),
    },
    {
      name: 'Anthropic',
      color: 'bg-orange-500/10 text-orange-600',
      models: ['Claude Opus 4.6', 'Claude Sonnet 4.6', 'Claude Haiku 4.6'],
      description: t('anthropicDesc'),
      comingSoon: true,
    },
    {
      name: 'Google',
      color: 'bg-blue-500/10 text-blue-600',
      models: ['Gemini 3.1 Pro', 'Gemini 3 Flash', 'Nano Banana Pro'],
      description: t('googleDesc'),
    },
  ];

  return (
    <section className="py-20 px-6 border-t border-border">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="mt-3 text-muted-foreground text-lg">{t('subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {providers.map((provider) => (
            <div
              key={provider.name}
              className="rounded-xl border border-border bg-card p-6 hover:border-primary/30 transition-colors"
            >
              <div className="mb-4">
                <span
                  className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${provider.color}`}
                >
                  {provider.name}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{provider.description}</p>
              <div className="flex flex-wrap gap-2">
                {provider.models.map((model) => (
                  <span
                    key={model}
                    className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-mono text-muted-foreground"
                  >
                    {model}
                    {provider.comingSoon && <span className="ml-1 text-orange-500 font-sans">{t('comingSoon')}</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">{t('footnote')}</p>
      </div>
    </section>
  );
}
