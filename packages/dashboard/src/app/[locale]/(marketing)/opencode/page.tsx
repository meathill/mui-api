import { ArrowUpRight } from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { buildMetadata, getResolvedLocale } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  const t = await getTranslations({ locale: resolvedLocale, namespace: 'opencode.metadata' });

  return buildMetadata({
    path: '/opencode',
    title: t('title'),
    description: t('description'),
    locale: resolvedLocale,
  });
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://api.muirouter.com';
const CONFIG_PATH = '~/.config/opencode/opencode.json';

/**
 * 配置片段只列几个代表性模型——完整清单在 /pricing，页面里硬编码 30 个会立刻过时。
 * 生成完整片段用 `node packages/app/scripts/gen-models-dev-toml.ts`，产物里带 opencode.json。
 */
const SAMPLE_MODELS = ['claude-opus-5', 'gpt-5.6', 'gemini-3-flash', 'kimi-k3'] as const;

const CONFIG_SNIPPET = JSON.stringify(
  {
    $schema: 'https://opencode.ai/config.json',
    provider: {
      muirouter: {
        npm: '@ai-sdk/openai-compatible',
        name: 'MuiRouter',
        options: { baseURL: `${API_BASE}/v1`, apiKey: '{env:MUIROUTER_API_KEY}' },
        models: Object.fromEntries(SAMPLE_MODELS.map((id) => [id, {}])),
      },
    },
  },
  null,
  2,
);

interface RelatedLink {
  href: string;
  label: string;
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

export default async function OpencodePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'opencodePage' });
  const related = t.raw('related') as RelatedLink[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <p className="text-sm font-medium text-primary mb-3">opencode</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{t('title')}</h1>
        <p className="text-base text-muted-foreground leading-relaxed">{t('intro')}</p>
      </header>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-2">{t('keyTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{t('keyDesc')}</p>
        <CodeBlock>{'export MUIROUTER_API_KEY=sk-gw-xxxxxxxx'}</CodeBlock>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-2">{t('configTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-2">{t('configDesc')}</p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{CONFIG_PATH}</code>
        </p>
        <CodeBlock>{CONFIG_SNIPPET}</CodeBlock>
        <p className="text-sm text-muted-foreground leading-relaxed mt-3">
          {t('configNote')}{' '}
          <Link href="/pricing" className="text-primary hover:underline">
            {t('pricingLink')}
          </Link>
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-2">{t('runTitle')}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{t('runDesc')}</p>
        <CodeBlock>{'opencode\n/models'}</CodeBlock>
      </section>

      <section className="mb-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('discoveryTitle')}</CardTitle>
            <CardDescription>{t('discoveryDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground leading-relaxed">{t('discoveryBody')}</CardContent>
        </Card>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-3">{t('relatedTitle')}</h2>
        <ul className="space-y-2">
          {related.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                {item.label}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
