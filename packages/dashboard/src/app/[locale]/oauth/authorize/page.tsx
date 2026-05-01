import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { oauthClients } from '@/db/app-schema';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';

/**
 * OAuth 2.0 授权页。
 *
 * 流程：
 *   1. 第三方客户端把用户跳到 /oauth/authorize?client_id=...&redirect_uri=...&state=...&scope=...
 *   2. 未登录 → 把当前 URL 编码进 ?next 让用户登录后回到这里
 *   3. 已登录 → 展示 consent，用户同意后 POST /api/oauth/decision，
 *      decision route 写 oauth_codes 表后把浏览器 302 到 redirect_uri 带 code+state
 *   4. 拒绝则 302 redirect_uri?error=access_denied
 *
 * 严格按 muirouter-spec.md「§ OAuth 2.0」约定。redirect_uri 必须命中客户端白名单，
 * 否则直接 400 拒绝（防 redirect_uri 劫持）。
 */

export const dynamic = 'force-dynamic';

const SUPPORTED_SCOPES = ['balance', 'llm'];

type AuthorizeQuery = {
  client_id?: string;
  redirect_uri?: string;
  state?: string;
  scope?: string;
  response_type?: string;
};

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<AuthorizeQuery> }) {
  const params = await searchParams;
  const clientId = params.client_id?.trim() ?? '';
  const redirectUri = params.redirect_uri?.trim() ?? '';
  const state = params.state?.trim() ?? '';
  const scope = (params.scope?.trim() ?? 'balance,llm')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const responseType = params.response_type?.trim() ?? 'code';

  if (!clientId || !redirectUri || !state) {
    return <ErrorCard title="参数缺失" message="缺少 client_id / redirect_uri / state，请回到原应用重新发起。" />;
  }
  if (responseType !== 'code') {
    return <ErrorCard title="响应类型不支持" message={`response_type 仅支持 code，收到 ${responseType}`} />;
  }

  const db = await getDb();
  const clientRow = (await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1))[0];
  if (!clientRow || !clientRow.isActive) {
    return <ErrorCard title="未知客户端" message={`client_id=${clientId} 未注册或已禁用，请联系开发者。`} />;
  }

  let allowedRedirects: string[] = [];
  try {
    const parsed = JSON.parse(clientRow.allowedRedirectUris);
    if (Array.isArray(parsed)) allowedRedirects = parsed.filter((s): s is string => typeof s === 'string');
  } catch {}
  if (!allowedRedirects.includes(redirectUri)) {
    return (
      <ErrorCard title="redirect_uri 不在白名单" message={`${redirectUri} 没有登记，请到 muirouter 后台改 client。`} />
    );
  }

  const allowedScopes = clientRow.allowedScopes
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const requestedScopes = scope.filter((s) => SUPPORTED_SCOPES.includes(s));
  const grantedScopes = requestedScopes.filter((s) => allowedScopes.includes(s));
  if (grantedScopes.length === 0) {
    return (
      <ErrorCard
        title="scope 不被允许"
        message={`请求 scope=${scope.join(',')}，但 client 仅允许 ${clientRow.allowedScopes}`}
      />
    );
  }

  const { user } = await getSession();
  if (!user) {
    const nextUrl = new URL('/oauth/authorize', 'http://placeholder');
    nextUrl.searchParams.set('client_id', clientId);
    nextUrl.searchParams.set('redirect_uri', redirectUri);
    nextUrl.searchParams.set('state', state);
    nextUrl.searchParams.set('scope', scope.join(','));
    nextUrl.searchParams.set('response_type', 'code');
    redirect(`/login?next=${encodeURIComponent(nextUrl.pathname + nextUrl.search)}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-bold">授权 {clientRow.name} 访问你的 muirouter 账号</h1>
        <p className="mt-1 text-sm text-muted-foreground">已登录为 {user.email}</p>

        <div className="mt-4 space-y-2 rounded-md border p-3 text-sm">
          <p className="font-medium">应用将获得以下权限：</p>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            {grantedScopes.includes('balance') && <li>查看你的钱包余额</li>}
            {grantedScopes.includes('llm') && <li>用你的 muirouter 余额代你调用 LLM</li>}
          </ul>
          <p className="text-xs text-muted-foreground">
            授权后，<code className="rounded bg-muted px-1 py-0.5 font-mono">{redirectUri}</code> 会拿到一次性
            authorization_code 用来换 token。你可以随时在「Keys」页面里撤销。
          </p>
        </div>

        <form method="POST" action="/api/oauth/decision" className="mt-6 flex gap-3">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="redirect_uri" value={redirectUri} />
          <input type="hidden" name="state" value={state} />
          <input type="hidden" name="scope" value={grantedScopes.join(',')} />
          <Button type="submit" name="decision" value="approve" className="flex-1">
            同意授权
          </Button>
          <Button type="submit" name="decision" value="deny" variant="outline" className="flex-1">
            拒绝
          </Button>
        </form>
      </Card>
    </div>
  );
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-bold text-destructive">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </Card>
    </div>
  );
}
