import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PawIcon } from '@/components/brand/paw-icon';
import { LanguageSwitcher } from '@/components/language-switcher';
import { HeaderAuthCta } from '@/components/marketing/header-auth-cta';
import { HeaderNav } from '@/components/marketing/header-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { Link } from '@/i18n/navigation';

export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // 显式 setRequestLocale 让 next-intl 在 SSG 时拿到 locale，
  // 否则 getTranslations 会落入 cookie/header 动态读取，导致整树 force dynamic。
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('header');
  const copyrightYear = new Date().getFullYear();

  // footer 需要的翻译，复用 header 的 key
  const ft = t;
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex min-h-14 flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-heading text-xl font-bold tracking-tight">
            <Image
              src="/brand/mui-mark.png"
              alt=""
              width={28}
              height={28}
              className="shrink-0 rounded-md border border-[var(--brand-rule-strong)]"
              aria-hidden
              priority
            />
            MuiRouter
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1 sm:gap-1">
            <HeaderNav />
            <span className="min-w-4 flex-1" aria-hidden="true" />
            <HeaderAuthCta />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border py-10 text-sm text-muted-foreground">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-foreground">
                {t.has('products') ? t('products') : 'Products'}
              </p>
              <ul className="space-y-2">
                <li>
                  <Link href="/ai-router" className="hover:text-foreground transition-colors">
                    {ft('aiRouter')}
                  </Link>
                </li>
                <li>
                  <Link href="/llm-router" className="hover:text-foreground transition-colors">
                    {ft('llmRouter')}
                  </Link>
                </li>
                <li>
                  <Link href="/openai-compatible-router" className="hover:text-foreground transition-colors">
                    {ft('openaiCompatibleRouter')}
                  </Link>
                </li>
                <li>
                  <Link href="/mcp-router" className="hover:text-foreground transition-colors">
                    {ft('mcpRouter')}
                  </Link>
                </li>
                <li>
                  <Link href="/mcp-server" className="hover:text-foreground transition-colors">
                    {ft('mcpServer')}
                  </Link>
                </li>
                <li>
                  <Link href="/opencode" className="hover:text-foreground transition-colors">
                    {ft('opencode')}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-foreground">
                {t.has('gateways') ? t('gateways') : 'Gateways'}
              </p>
              <ul className="space-y-2">
                <li>
                  <Link href="/claude-api-gateway" className="hover:text-foreground transition-colors">
                    {t.has('claudeGateway') ? t('claudeGateway') : 'Claude Gateway'}
                  </Link>
                </li>
                <li>
                  <Link href="/gpt-api-gateway" className="hover:text-foreground transition-colors">
                    {t.has('gptGateway') ? t('gptGateway') : 'GPT Gateway'}
                  </Link>
                </li>
                <li>
                  <Link href="/gemini-api-gateway" className="hover:text-foreground transition-colors">
                    {t.has('geminiGateway') ? t('geminiGateway') : 'Gemini Gateway'}
                  </Link>
                </li>
                <li>
                  <Link href="/grok-api-gateway" className="hover:text-foreground transition-colors">
                    {t.has('grokGateway') ? t('grokGateway') : 'Grok Gateway'}
                  </Link>
                </li>
                <li>
                  <Link href="/mcp" className="hover:text-foreground transition-colors">
                    {ft('mcp')}
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-foreground transition-colors">
                    {ft('pricing')}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-foreground">
                {t.has('compare') ? t('compare') : 'Compare'}
              </p>
              <ul className="space-y-2">
                <li>
                  <Link href="/muirouter-vs-openrouter" className="hover:text-foreground transition-colors">
                    {t.has('muirouterVsOpenrouter') ? t('muirouterVsOpenrouter') : 'MuiRouter vs OpenRouter'}
                  </Link>
                </li>
                <li>
                  <Link href="/litellm-vs-muirouter" className="hover:text-foreground transition-colors">
                    {t.has('litellmVsMuirouter') ? t('litellmVsMuirouter') : 'LiteLLM vs MuiRouter'}
                  </Link>
                </li>
                <li>
                  <Link href="/openrouter-alternatives" className="hover:text-foreground transition-colors">
                    {ft('openrouterAlternatives')}
                  </Link>
                </li>
                <li>
                  <Link href="/best-llm-gateway" className="hover:text-foreground transition-colors">
                    {ft('bestLlmGateway')}
                  </Link>
                </li>
                <li>
                  <a href="https://firstlook.tools" className="hover:text-foreground transition-colors">
                    First Look
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-foreground">
                {t.has('legal') ? t('legal') : 'Legal'}
              </p>
              <ul className="space-y-2">
                <li>
                  <Link href="/terms" className="hover:text-foreground transition-colors">
                    {t.has('terms') ? t('terms') : 'Terms'}
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-foreground transition-colors">
                    {t.has('privacy') ? t('privacy') : 'Privacy'}
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="hover:text-foreground transition-colors">
                    {t.has('about') ? t('about') : 'About'}
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-foreground transition-colors">
                    {t.has('contact') ? t('contact') : 'Contact'}
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="hover:text-foreground transition-colors">
                    {ft('blog')}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-center sm:text-left">
              &copy; {copyrightYear} Meathill LLC. All rights reserved.
              <span className="mx-2 text-muted-foreground/50">·</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-[var(--brand-yellow-deep)] align-middle">
                supervised by Mui
                <PawIcon className="size-3.5" />
              </span>
              <span className="ml-2 text-muted-foreground/50">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
            </div>
            <div className="flex items-center justify-center gap-2 sm:justify-end">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
