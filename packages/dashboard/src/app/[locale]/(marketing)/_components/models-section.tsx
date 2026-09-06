import { ArrowRight } from '@phosphor-icons/react/ssr';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function ModelsSection() {
  const t = useTranslations('models');

  const providers = [
    {
      name: 'OpenAI',
      color: 'bg-[var(--brand-fluff)] text-[var(--brand-yellow-deep)] border border-[var(--brand-corgi)]',
      models: ['GPT-6 Astra', 'GPT-5.6 Sol', 'GPT-5.6 Terra', 'GPT-5.6 Luna', 'GPT Image 2'],
      description: t('openaiDesc'),
    },
    {
      name: 'Anthropic',
      color:
        'bg-[#fadfd5] text-[#c44a32] border border-[var(--brand-tongue)] dark:bg-[#e8775a]/20 dark:text-[#ffb7a3] dark:border-[#e8775a]/30',
      models: ['Claude Fable 5.1', 'Claude Opus 5', 'Claude Sonnet 5', 'Claude Haiku 4.5', 'Claude Opus 4.6'],
      description: t('anthropicDesc'),
    },
    {
      name: 'DeepSeek',
      color:
        'bg-blue-500/10 text-blue-800 border border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-400/30',
      models: ['DeepSeek V4 Flash', 'DeepSeek V4 Pro', 'DeepSeek V3', 'DeepSeek R1'],
      description: t('deepseekDesc'),
    },
    {
      name: 'Moonshot AI',
      color:
        'bg-cyan-500/10 text-cyan-800 border border-cyan-500/30 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-400/30',
      models: ['Kimi K3', 'Kimi K2.7 Code', 'Kimi K2.6', 'Kimi K2'],
      description: t('moonshotDesc'),
    },
    {
      name: 'xAI',
      color: 'bg-[var(--brand-ink)] text-[var(--brand-cream)] border border-[var(--brand-ink-soft)]',
      models: ['Grok 4.6', 'Grok 4.5', 'Grok 4.3', 'Grok Imagine Image'],
      description: t('grokDesc'),
    },
    {
      name: 'Zhipu GLM',
      color:
        'bg-violet-500/10 text-violet-800 border border-violet-500/30 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-400/30',
      models: ['GLM-5.3', 'GLM-5.3 Flash', 'GLM-5.2', 'GLM-4.7 Flash'],
      description: t('zaiDesc'),
    },
    {
      name: 'Qwen',
      color:
        'bg-amber-500/10 text-amber-800 border border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/30',
      models: ['Qwen3.8 Max', 'Qwen3.7 Max', 'Qwen3.7 Plus', 'Qwen3-30B'],
      description: t('qwenDesc'),
    },
    {
      name: 'MiniMax',
      color:
        'bg-teal-500/10 text-teal-800 border border-teal-500/30 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-400/30',
      models: ['MiniMax M3', 'MiniMax M2.7', 'MiniMax M2.5'],
      description: t('minimaxDesc'),
    },
    {
      name: 'Meta',
      color:
        'bg-sky-500/10 text-sky-800 border border-sky-500/30 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-400/30',
      models: ['Muse Spark 1.3', 'Muse Spark 1.2'],
      description: t('metaDesc'),
    },
  ];

  return (
    <section className="py-14 border-t border-border">
      <div className="container mx-auto px-6">
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
                    className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground dark:bg-white/[0.07] dark:text-foreground/75"
                  >
                    {model}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/models"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-yellow-deep)] hover:text-[var(--brand-ink)] transition-colors"
          >
            {t('viewAll')}
            <ArrowRight size={14} />
          </Link>
          <p className="text-center text-sm text-muted-foreground">{t('footnote')}</p>
        </div>
      </div>
    </section>
  );
}
