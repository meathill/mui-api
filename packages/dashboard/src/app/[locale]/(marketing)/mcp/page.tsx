import {
  ArrowUpRight,
  ArrowsClockwise,
  CheckCircle,
  Cpu,
  Globe,
  Lightning,
  ShieldCheck,
  TerminalWindow,
} from '@phosphor-icons/react/ssr';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { buildMetadata, getResolvedLocale } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const resolvedLocale = getResolvedLocale(locale);
  const t = await getTranslations({ locale: resolvedLocale, namespace: 'mcp.metadata' });

  return buildMetadata({
    path: '/mcp',
    title: t('title'),
    description: t('description'),
    locale: resolvedLocale,
  });
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'https://api.muirouter.com';
const MCP_URL = `${API_BASE}/mcp`;
const CLAUDE_DESKTOP_CONFIG_PATH = '~/Library/Application Support/Claude/claude_desktop_config.json';

// 工具名与示例是字面量；说明文案走 i18n（mcpPage.tools.<name>）。
const TOOL_NAMES = [
  'get_balance',
  'get_usage',
  'list_recharges',
  'list_models',
  'create_topup_session',
  'image_generation',
] as const;

const TOOL_EXAMPLES: Record<(typeof TOOL_NAMES)[number], string> = {
  get_balance: '{ "name": "get_balance", "arguments": {} }',
  get_usage: '{ "name": "get_usage", "arguments": { "limit": 20, "model": "gpt-4o" } }',
  list_recharges: '{ "name": "list_recharges", "arguments": { "limit": 20 } }',
  list_models: '{ "name": "list_models", "arguments": {} }',
  create_topup_session: '{ "name": "create_topup_session", "arguments": { "amount_cents": 1000, "currency": "usd" } }',
  image_generation: '{ "name": "image_generation", "arguments": { "model": "gpt-image-2", "prompt": "a cute cat" } }',
};

interface McpRelatedLink {
  href: string;
  label: string;
}

export default async function McpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'mcpPage' });
  const related = t.raw('related') as McpRelatedLink[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <header className="mb-10 text-center sm:text-left">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary mb-3">
          <Lightning size={14} weight="bold" />
          {t('badge')}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">{t('title')}</h1>
        <p className="text-base text-muted-foreground leading-relaxed">{t('intro')}</p>
      </header>

      {/* 1. 双 Era 协议架构 */}
      <Card className="mb-8 border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cpu size={20} className="text-primary" />
            <CardTitle>{t('protocolTitle')}</CardTitle>
          </div>
          <CardDescription>{t('protocolDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-2.5 rounded-lg border border-border/80 bg-background/80 p-3">
            <CheckCircle size={18} className="mt-0.5 shrink-0 text-green-600 dark:text-green-400" weight="fill" />
            <div>
              <p className="font-medium text-foreground">{t('modernEra')}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border border-border/80 bg-background/80 p-3">
            <ArrowsClockwise size={18} className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-medium text-foreground">{t('legacyEra')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. 端点与鉴权 */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe size={20} className="text-primary" />
            <CardTitle>{t('endpointTitle')}</CardTitle>
          </div>
          <CardDescription>{t('endpointDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Endpoint</div>
            <pre className="rounded-lg bg-muted px-4 py-3 text-sm font-mono overflow-x-auto">
              <code>POST {MCP_URL}</code>
            </pre>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Header</div>
            <pre className="rounded-lg bg-muted px-4 py-3 text-sm font-mono overflow-x-auto">
              <code>Authorization: Bearer sk-gw-xxxxxxxx</code>
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* 3. 多 Server 聚合接入（Claude Code 示例） */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TerminalWindow size={20} className="text-primary" />
            <CardTitle>{t('aggregationTitle')}</CardTitle>
          </div>
          <CardDescription>{t('aggregationDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="rounded-lg bg-muted p-4 text-sm font-mono overflow-x-auto">
            <code>{`{
  "mcpServers": {
    "muirouter": {
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer sk-gw-xxxxxxxx"
      }
    },
    "local-tools": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"]
    }
  }
}`}</code>
          </pre>
          <p className="text-sm text-muted-foreground mt-3">{t('aggregationNote')}</p>
        </CardContent>
      </Card>

      {/* 4. 其他客户端接入 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('clientsTitle')}</CardTitle>
          <CardDescription>{t('clientsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t('cursorDesc', { url: MCP_URL, header: 'Authorization: Bearer sk-gw-...' })}</p>
          <p>{t('claudeDesktopDesc', { path: CLAUDE_DESKTOP_CONFIG_PATH })}</p>
        </CardContent>
      </Card>

      {/* 5. 可用工具箱 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('toolsTitle')}</CardTitle>
          <CardDescription>{t('toolsDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {TOOL_NAMES.map((name) => (
              <div key={name} className="border-l-2 border-primary/30 pl-4">
                <div className="font-mono text-sm font-medium mb-1">{name}</div>
                <p className="text-sm text-muted-foreground mb-2">{t(`tools.${name}`)}</p>
                <pre className="rounded bg-muted px-3 py-2 text-xs font-mono overflow-x-auto">
                  <code>{TOOL_EXAMPLES[name]}</code>
                </pre>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 6. JSON-RPC 与 curl 调试 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('jsonRpcTitle')}</CardTitle>
          <CardDescription>{t('jsonRpcDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="rounded-lg bg-muted p-4 text-sm font-mono overflow-x-auto">
            <code>{`# Discover server capabilities (Modern 2026-07-28)
curl -X POST ${MCP_URL} \\
  -H "Authorization: Bearer sk-gw-xxxxxxxx" \\
  -H "MCP-Protocol-Version: 2026-07-28" \\
  -H "Mcp-Method: server/discover" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"server/discover","params":{"_meta":{"protocolVersion":"2026-07-28"}}}'

# List tools
curl -X POST ${MCP_URL} \\
  -H "Authorization: Bearer sk-gw-xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# Call get_balance
curl -X POST ${MCP_URL} \\
  -H "Authorization: Bearer sk-gw-xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc":"2.0",
    "id":3,
    "method":"tools/call",
    "params": {"name":"get_balance","arguments":{}}
  }'`}</code>
          </pre>
        </CardContent>
      </Card>

      {/* 7. 安全须知 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-primary" />
            <CardTitle>{t('securityTitle')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• {t('security1')}</p>
          <p>• {t('security2')}</p>
          <p>• {t('security3')}</p>
        </CardContent>
      </Card>

      {/* 相关页面 */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight text-center mb-4">{t('relatedTitle')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {related.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group inline-flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:border-[var(--brand-corgi)] hover:text-[var(--brand-yellow-deep)]"
            >
              {link.label}
              <ArrowUpRight size={16} className="text-muted-foreground group-hover:text-[var(--brand-yellow-deep)]" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
