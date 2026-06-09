import { useTranslations } from 'next-intl';

function CodeBlock({ filename, children }: { filename: string; children: string }) {
  return (
    <div className="rounded-lg border-2 border-[#3a2e23] bg-[#231b14] shadow-[0_3px_0_0_#3a2e23] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-[var(--brand-tongue)]" />
          <div className="h-3 w-3 rounded-full bg-[var(--brand-yellow)]" />
          <div className="h-3 w-3 rounded-full bg-[var(--brand-corgi)]" />
        </div>
        <span className="ml-2 text-xs text-[var(--brand-corgi)]/70 font-mono">{filename}</span>
      </div>
      <pre className="p-5 overflow-x-auto text-sm leading-relaxed">
        <code className="text-[#f3e9d5] font-mono whitespace-pre">{children}</code>
      </pre>
    </div>
  );
}

export function CodeSection() {
  const t = useTranslations('code');

  const openaiExample = `from openai import OpenAI

client = OpenAI(
    api_key="sk-your-mui-router-key",
    base_url="https://your-domain.com/v1",
)

${t('comment')}
response = client.chat.completions.create(
    model="gpt-4o",          ${t('modelComment')}
    messages=[{"role": "user", "content": "${t('hello')}"}],
)

print(response.choices[0].message.content)`;

  const claudeCodeExample = `${t('nativeComment')}
export ANTHROPIC_BASE_URL=https://your-domain.com
export ANTHROPIC_AUTH_TOKEN=sk-your-mui-router-key

claude   ${t('nativeRunComment')}`;

  return (
    <section className="py-14 px-6 bg-muted/40">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="mt-3 text-muted-foreground text-lg">{t('subtitle')}</p>
        </div>

        <CodeBlock filename={t('filename')}>{openaiExample}</CodeBlock>
        <p className="mt-4 text-center text-sm text-muted-foreground">{t('footnote')}</p>

        <div className="text-center mt-12 mb-8">
          <h3 className="text-2xl font-bold tracking-tight">{t('nativeTitle')}</h3>
          <p className="mt-3 text-muted-foreground text-lg">{t('nativeSubtitle')}</p>
        </div>

        <CodeBlock filename={t('nativeFilename')}>{claudeCodeExample}</CodeBlock>
        <p className="mt-4 text-center text-sm text-muted-foreground">{t('nativeFootnote')}</p>
      </div>
    </section>
  );
}
