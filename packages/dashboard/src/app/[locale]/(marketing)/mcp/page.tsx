import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

const tools: Array<{ name: string; desc: string; example: string }> = [
  {
    name: 'get_balance',
    desc: '查询当前 API key 所属用户的钱包余额、累计充值与累计消费。',
    example: '{ "name": "get_balance", "arguments": {} }',
  },
  {
    name: 'get_usage',
    desc: '分页查询当前用户的 API 调用消耗明细，可按模型、时间范围筛选。',
    example: '{ "name": "get_usage", "arguments": { "limit": 20, "model": "gpt-4o" } }',
  },
  {
    name: 'list_recharges',
    desc: '分页查询当前用户的充值记录。',
    example: '{ "name": "list_recharges", "arguments": { "limit": 20 } }',
  },
  {
    name: 'list_models',
    desc: '列出 MUI Router 当前支持的所有模型及其计价（input/output、markup_rate）。',
    example: '{ "name": "list_models", "arguments": {} }',
  },
  {
    name: 'create_topup_session',
    desc: '创建一次 Stripe 充值会话，返回支付链接，AI 客户端可引导用户完成支付。',
    example: '{ "name": "create_topup_session", "arguments": { "amount_cents": 1000, "currency": "usd" } }',
  },
  {
    name: 'image_generation',
    desc: '通过 MUI Router 调用 OpenAI 兼容的图像生成接口（会消耗钱包余额）。',
    example: '{ "name": "image_generation", "arguments": { "model": "gpt-image-2", "prompt": "a cute cat" } }',
  },
];

export default function McpPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <p className="text-sm font-medium text-primary mb-3">Model Context Protocol</p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">MCP 接入指南</h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          MUI Router 提供 streamable-HTTP 形态的 MCP 服务，让 Claude Desktop、Claude Code、Cursor、Cline 等 AI
          客户端直接调用——AI 助手可以替你查余额、看用量、列模型、生成图像，甚至发起充值。 完全使用你自己的 sk-gw- API
          key 鉴权，第三方与 AI 客户端均无需注册新账号。
        </p>
      </header>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>1. 服务端点</CardTitle>
          <CardDescription>所有 MCP 客户端连接同一个 URL，使用 Bearer 鉴权。</CardDescription>
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
          <p className="text-sm text-muted-foreground">
            协议版本：MCP 2025-06-18，传输：streamable-http，无状态 JSON-RPC 2.0。
          </p>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>2. 在 Claude Code 中接入</CardTitle>
          <CardDescription>编辑 ~/.claude/mcp.json，添加 muirouter server。</CardDescription>
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
    }
  }
}`}</code>
          </pre>
          <p className="text-sm text-muted-foreground mt-3">
            重启 Claude Code 后，输入 <code className="rounded bg-muted px-1 py-0.5 text-xs">/mcp</code> 即可看到
            muirouter 工具列表。
          </p>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>3. 在 Cursor / Claude Desktop 中接入</CardTitle>
          <CardDescription>同样填入上面的 URL 与 Authorization header 即可。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Cursor</strong>：Settings → MCP → Add new server， 选择 streamable-http
            类型，URL 填 <code className="rounded bg-muted px-1 py-0.5 text-xs">{MCP_URL}</code>， 自定义 header 加{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">Authorization: Bearer sk-gw-...</code>。
          </p>
          <p>
            <strong className="text-foreground">Claude Desktop</strong>：编辑配置文件 (macOS:{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              ~/Library/Application Support/Claude/claude_desktop_config.json
            </code>
            )，与上面 Claude Code 配置一致。
          </p>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>4. 可用工具</CardTitle>
          <CardDescription>共 6 个工具，覆盖账户查询、计价、图像生成、充值。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tools.map((tool) => (
              <div key={tool.name} className="border-l-2 border-primary/30 pl-4">
                <div className="font-mono text-sm font-medium mb-1">{tool.name}</div>
                <p className="text-sm text-muted-foreground mb-2">{tool.desc}</p>
                <pre className="rounded bg-muted px-3 py-2 text-xs font-mono overflow-x-auto">
                  <code>{tool.example}</code>
                </pre>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>5. 直接 JSON-RPC 调用</CardTitle>
          <CardDescription>不通过 MCP 客户端，也可以用 curl 直接调。</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="rounded-lg bg-muted p-4 text-sm font-mono overflow-x-auto">
            <code>{`# 列出工具
curl -X POST ${MCP_URL} \\
  -H "Authorization: Bearer sk-gw-xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# 调用 get_balance
curl -X POST ${MCP_URL} \\
  -H "Authorization: Bearer sk-gw-xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc":"2.0",
    "id":2,
    "method":"tools/call",
    "params": {"name":"get_balance","arguments":{}}
  }'`}</code>
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>6. 安全提示</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • API key 等同于密码，不要在公共仓库或聊天记录中泄露； 如怀疑泄露，请到{' '}
            <a href="/keys" className="text-primary underline">
              Keys
            </a>{' '}
            页面立即吊销。
          </p>
          <p>
            • <code className="rounded bg-muted px-1 py-0.5 text-xs">image_generation</code> 与{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">create_topup_session</code> 会消耗或动用资金，建议在
            AI 客户端里把这两个工具改成需要确认的模式。
          </p>
          <p>• 所有请求都按 sk-gw- key 关联到对应账户，并发与计费策略与直接调用 REST API 一致。</p>
        </CardContent>
      </Card>
    </div>
  );
}
