import { useTranslations } from 'next-intl';

export function ModelsSection() {
  const t = useTranslations('models');

  const providers = [
    {
      name: 'OpenAI',
      color: 'bg-[var(--brand-fluff)] text-[var(--brand-yellow-deep)] border border-[var(--brand-corgi)]',
      models: ['GPT-5.6 Sol', 'GPT-5.6 Terra', 'GPT-5.6 Luna', 'GPT Image 2'],
      description: t('openaiDesc'),
    },
    {
      name: 'Anthropic',
      color: 'bg-[#fadfd5] text-[#c44a32] border border-[var(--brand-tongue)]',
      models: ['Claude Opus 5', 'Claude Fable 5', 'Claude Sonnet 5', 'Claude Haiku 4.5'],
      description: t('anthropicDesc'),
    },
    {
      name: 'Google',
      color: 'bg-[var(--brand-corgi)]/30 text-[var(--brand-ink)] border border-[var(--brand-yellow-warm)]',
      models: ['Gemini 3.1 Pro', 'Gemini 3.1 Flash Lite', 'Gemini 3 Flash', 'Gemini 2.5 Pro'],
      description: t('googleDesc'),
    },
    {
      name: 'DeepSeek',
      color: 'bg-blue-500/10 text-blue-800 border border-blue-500/30',
      models: ['DeepSeek V4 Flash', 'DeepSeek V4 Pro', 'DeepSeek V3', 'DeepSeek R1'],
      description: t('deepseekDesc'),
    },
    {
      name: 'Moonshot AI',
      color: 'bg-cyan-500/10 text-cyan-800 border border-cyan-500/30',
      models: ['Kimi K3', 'Kimi K2.6', 'Kimi K2', 'Kimi Vision'],
      description: t('moonshotDesc'),
    },
    {
      name: 'xAI',
      color: 'bg-[var(--brand-ink)] text-[var(--brand-cream)] border border-[var(--brand-ink-soft)]',
      models: ['Grok 4.5', 'Grok 4.3', 'Grok Imagine Image'],
      description: t('grokDesc'),
    },
    {
      name: 'Workers AI',
      color: 'bg-[var(--brand-paper-deep)] text-[var(--brand-ink-soft)] border border-[var(--brand-rule-strong)]',
      models: ['GLM-4.7 Flash', 'Qwen3-30B', 'Kimi K2.6'],
      description: t('workersDesc'),
    },
    {
      name: 'Xiaomi MiMo',
      color: 'bg-[var(--brand-yellow)] text-[#3a2e23] border border-[var(--brand-yellow-deep)]',
      models: ['MiMo v2.5 Pro', 'MiMo v2.5', 'MiMo v2.5 Flash', 'MiMo TTS'],
      description: t('mimoDesc'),
    },
  ];

  return (
    <section className="py-14 px-6 border-t border-border">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="mt-3 text-muted-foreground text-lg">{t('subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => (
            <div
              key={provider.name}
              className="rounded-lg border border-border bg-card p-5 hover:border-[var(--brand-yellow-deep)] hover:shadow-[0_2px_0_0_var(--brand-yellow-deep)] transition-all"
            >
              <div className="mb-3">
                <span
                  className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${provider.color}`}
                >
                  {provider.name}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{provider.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {provider.models.map((model) => (
                  <span
                    key={model}
                    className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground"
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
