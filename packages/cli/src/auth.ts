import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import {
  API_BASE_URL,
  CLI_CLIENT_ID,
  CLI_REDIRECT_URI,
  CONTROL_SCOPES,
  SITE_BASE_URL,
} from '../../shared-db/src/integration.ts';
import { loginPath, readJson, saveJson, type LoginCredentials } from './storage.ts';

export function validateApiBase(value: string) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
  )
    throw new Error('API 地址必须是 HTTPS 或本地测试地址');
  return value.replace(/\/+$/, '');
}

async function exchange(apiBaseUrl: string, body: Record<string, string>): Promise<LoginCredentials> {
  const response = await fetch(`${apiBaseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: CLI_CLIENT_ID, ...body }),
    signal: AbortSignal.timeout(30_000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`授权失败：HTTP ${response.status}`);
  const token = (await response.json()) as { access_token: string; refresh_token: string; expires_in: number };
  if (!token.access_token || !token.refresh_token) throw new Error('授权响应缺少 token');
  const credentials = {
    apiBaseUrl,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  };
  await saveJson(loginPath(), credentials, true);
  return credentials;
}

export async function login(apiBase = API_BASE_URL, website = SITE_BASE_URL) {
  const apiBaseUrl = validateApiBase(apiBase);
  validateApiBase(website);
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const state = randomBytes(24).toString('base64url');
  const url = new URL('/oauth/authorize', website);
  url.search = new URLSearchParams({
    client_id: CLI_CLIENT_ID,
    redirect_uri: CLI_REDIRECT_URI,
    response_type: 'code',
    scope: ['balance', 'llm', ...CONTROL_SCOPES].join(' '),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((request, response) => {
      const callback = new URL(request.url ?? '/', CLI_REDIRECT_URI);
      if (callback.pathname !== '/callback' || callback.searchParams.get('state') !== state) {
        response.writeHead(400).end('授权回调无效');
        return;
      }
      const authorizationCode = callback.searchParams.get('code');
      response
        .writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
        .end(authorizationCode ? '授权完成，可以关闭此页面。' : '授权未完成。');
      clearTimeout(timer);
      server.close();
      if (authorizationCode) resolve(authorizationCode);
      else reject(new Error('用户未完成授权'));
    });
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('登录超时，请重新运行 muirouter login'));
    }, 300_000);
    server.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    server.listen(18764, '127.0.0.1', () => {
      process.stderr.write(`请在浏览器完成一次授权：${url}\n`);
      const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'rundll32' : 'xdg-open';
      const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url.toString()] : [url.toString()];
      const child = spawn(command, args, { stdio: 'ignore' });
      child.on('error', () => {});
      child.unref();
    });
  });
  return exchange(apiBaseUrl, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: CLI_REDIRECT_URI,
    code_verifier: verifier,
  });
}

export async function credentials() {
  const saved = await readJson<LoginCredentials>(loginPath());
  if (!saved) return login();
  validateApiBase(saved.apiBaseUrl);
  return saved.expiresAt > Date.now() + 60_000
    ? saved
    : exchange(saved.apiBaseUrl, { grant_type: 'refresh_token', refresh_token: saved.refreshToken });
}

export async function control<T>(operation: string, input: unknown = {}): Promise<T> {
  const auth = await credentials();
  const response = await fetch(`${auth.apiBaseUrl}/control/${operation}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${auth.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
    redirect: 'error',
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(`${error.error ?? 'control_error'}: ${error.message ?? response.status}`);
  }
  return response.json() as Promise<T>;
}
