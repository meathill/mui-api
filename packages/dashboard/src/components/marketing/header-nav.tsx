'use client';

import { CaretDown } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/menu';
import { Link } from '@/i18n/navigation';

type NavLink = { href: string; labelKey: string; fallback: string };

const PRODUCTS: NavLink[] = [
  { href: '/ai-router', labelKey: 'aiRouter', fallback: 'AI Router' },
  { href: '/llm-router', labelKey: 'llmRouter', fallback: 'LLM Router' },
  { href: '/openai-compatible-router', labelKey: 'openaiCompatibleRouter', fallback: 'OpenAI-Compatible' },
  { href: '/mcp-router', labelKey: 'mcpRouter', fallback: 'MCP Router' },
  { href: '/mcp-server', labelKey: 'mcpServer', fallback: 'MCP Server' },
  { href: '/opencode', labelKey: 'opencode', fallback: 'opencode' },
];

const GATEWAYS: NavLink[] = [
  { href: '/claude-api-gateway', labelKey: 'claudeGateway', fallback: 'Claude Gateway' },
  { href: '/gpt-api-gateway', labelKey: 'gptGateway', fallback: 'GPT Gateway' },
  { href: '/gemini-api-gateway', labelKey: 'geminiGateway', fallback: 'Gemini Gateway' },
  { href: '/grok-api-gateway', labelKey: 'grokGateway', fallback: 'Grok Gateway' },
];

const COMPARE: NavLink[] = [
  { href: '/muirouter-vs-openrouter', labelKey: 'muirouterVsOpenrouter', fallback: 'MuiRouter vs OpenRouter' },
  { href: '/litellm-vs-muirouter', labelKey: 'litellmVsMuirouter', fallback: 'LiteLLM vs MuiRouter' },
  { href: '/openrouter-alternatives', labelKey: 'openrouterAlternatives', fallback: 'OpenRouter Alternatives' },
  { href: '/best-llm-gateway', labelKey: 'bestLlmGateway', fallback: 'Best LLM Gateway' },
];

function NavDropdown({ label, items }: { label: string; items: NavLink[] }) {
  const t = useTranslations('header');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        {label}
        <CaretDown size={12} className="opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {items.map((item) => (
          <DropdownMenuItem key={item.href} render={<Link href={item.href as never} />}>
            {t.has(item.labelKey) ? t(item.labelKey) : item.fallback}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function HeaderNav() {
  const t = useTranslations('header');

  return (
    <>
      <NavDropdown label={t.has('products') ? t('products') : 'Products'} items={PRODUCTS} />
      <NavDropdown label={t.has('gateways') ? t('gateways') : 'Gateways'} items={GATEWAYS} />
      <NavDropdown label={t.has('compare') ? t('compare') : 'Compare'} items={COMPARE} />
      <Link
        href="/pricing"
        className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {t('pricing')}
      </Link>
      <Link
        href="/mcp"
        className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {t('mcp')}
      </Link>
      <Link
        href="/blog"
        className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {t('blog')}
      </Link>
    </>
  );
}
