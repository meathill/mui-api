const PROVIDERS = [
  {
    name: 'OpenAI',
    color: 'bg-emerald-500/10 text-emerald-600',
    models: ['GPT-5.4', 'GPT-5.3-codex', 'GPT-5.4-mini'],
    description: '最强通用模型，代码、推理、多模态',
  },
  {
    name: 'Anthropic',
    color: 'bg-orange-500/10 text-orange-600',
    models: ['Claude Opus 4.6', 'Claude Sonnet 4.6', 'Claude Haiku 4.6'],
    description: '超长上下文，编程与分析能力出众',
  },
  {
    name: 'Google',
    color: 'bg-blue-500/10 text-blue-600',
    models: ['Gemini 3.1 Pro', 'Gemini 3 Flash', 'Nano Banana Pro'],
    description: '多模态原生，超大上下文窗口',
  },
];

export function ModelsSection() {
  return (
    <section className="py-20 px-6 border-t border-border">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">主流 AI 模型，一站接入</h2>
          <p className="mt-3 text-muted-foreground text-lg">支持 OpenAI、Anthropic、Google 三大厂商，持续扩展中</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PROVIDERS.map((provider) => (
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

        <p className="mt-6 text-center text-sm text-muted-foreground">
          同时支持 OpenAI 兼容模式和各厂商原生 API 透传，不丢失任何功能
        </p>
      </div>
    </section>
  );
}
