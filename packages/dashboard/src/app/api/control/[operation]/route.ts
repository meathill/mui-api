import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getSession } from '@/lib/session';

export async function POST(request: Request, context: { params: Promise<{ operation: string }> }) {
  // Cookie 授权的写接口必须同源；CLI/MCP 使用 API Worker 的 Bearer 入口。
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({ error: 'invalid_origin' }, { status: 403 });
  const { user } = await getSession();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { env } = await getCloudflareContext({ async: true });
  const { operation } = await context.params;
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const response = await env.MUIROUTER_CONTROL.execute(user.id, operation, input);
  return Response.json(response.result, { status: response.status, headers: { 'cache-control': 'no-store' } });
}
