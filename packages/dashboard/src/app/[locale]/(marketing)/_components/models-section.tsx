import { useTranslations } from 'next-intl';

export function ModelsSection() {
  const t = useTranslations('models');

  const providers = [
    {
      name: 'OpenAI',
      color: 'bg-emerald-500/10 text-emerald-600',
      models: ['GPT-5', 'GPT-5 mini', 'GPT-5 nano', 'GPT-4.1', 'GPT Image 2'],
      description: t('openaiDesc'),
    },
    {
      name: 'Anthropic',
      color: 'bg-orange-500/10 text-orange-600',
      models: ['Claude Opus 4.7', 'Claude Opus 4.6', 'Claude Sonnet 4.6', 'Claude Haiku 4.5'],
      description: t('anthropicDesc'),
    },
    {
      name: 'Google',
      color: 'bg-blue-500/10 text-blue-600',
      models: ['Gemini 2.5 Pro', 'Gemini 2.5 Flash', 'Gemini 2.5 Flash Lite', 'Gemini 3 Flash'],
      description: t('googleDesc'),
    },
    {
      name: 'Workers AI',
      color: 'bg-violet-500/10 text-violet-600',
      models: ['GLM-4.7 Flash', 'Qwen3-30B', 'Kimi K2.6'],
      description: t('workersDesc'),
    },
    {
      name: 'Xiaomi MiMo',
      color: 'bg-rose-500/10 text-rose-600',
      models: ['MiMo v2.5 Pro', 'MiMo v2.5', 'MiMo v2.5 Flash', 'MiMo TTS'],
      description: t('mimoDesc'),
    },
  ];

  return (
    <section className="py-20 px-6 border-t border-border">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="mt-3 text-muted-foreground text-lg">{t('subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
