import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { oauthClients, oauthCodes } from '@/db/app-schema';
import { getDb } from '@/lib/db';
import { getSession } from '@/lib/session';

/**
 * POST /api/oauth/decision —— 授权页 form 的提交目标。
 *
 * 校验：登录态 + client_id 有效 + redirect_uri 命中白名单。
 *
 * approve：生成一次性 authorization_code，写 oauth_codes（5min 过期），
 *          302 到 redirect_uri?code=...&state=...
 *
 * deny:    302 到 redirect_uri?error=access_denied&state=...
 *
 * 所有错误都尽量重定向回 redirect_uri 带 error，让客户端能统一处理；
 * 仅当 redirect_uri 本身校验失败时才直接报错（避免变成 open redirect）。
 */

const CODE_TTL_SEC = 5 * 60;

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const clientId = formString(form, 'client_id');
  const redirectUri = formString(form, 'redirect_uri');
  const state = formString(form, 'state');
  const scope = formString(form, 'scope');
  const decision = formString(form, 'decision');

  if (!clientId || !redirectUri || !state || !scope) {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }

  const db = await getDb();
  const clientRow = (await db.select().from(oauthClients).where(eq(oauthClients.clientId, clientId)).limit(1))[0];
  if (!clientRow || !clientRow.isActive) {
    return Response.json({ error: 'invalid_client' }, { status: 400 });
  }

  let allowedRedirects: string[] = [];
  try {
    const parsed: unknown = JSON.parse(clientRow.allowedRedirectUris);
    if (Array.isArray(parsed)) allowedRedirects = parsed.filter((value): value is string => typeof value === 'string');
  } catch {}
  if (!allowedRedirects.includes(redirectUri)) {
    return Response.json({ error: 'invalid_redirect_uri' }, { status: 400 });
  }

  if (decision !== 'approve') {
    redirect(appendQuery(redirectUri, { error: 'access_denied', state }));
  }

  const { user } = await getSession();
  if (!user) {
    redirect(appendQuery(redirectUri, { error: 'login_required', state }));
  }

  // 颁发一次性 authorization_code
  const code = await generateCode();
  const codeHash = await sha256Hex(code);
  await db.insert(oauthCodes).values({
    codeHash,
    clientId,
    userId: user.id,
    redirectUri,
    scope,
    expiresAt: new Date((Math.floor(Date.now() / 1000) + CODE_TTL_SEC) * 1000),
    used: false,
  });

  redirect(appendQuery(redirectUri, { code, state }));
}

function formString(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

function appendQuery(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

async function generateCode(): Promise<string> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
