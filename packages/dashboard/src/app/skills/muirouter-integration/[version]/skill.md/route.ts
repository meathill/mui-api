import { INTEGRATION_VERSION } from '@muirouter/shared-db/integration';
import { INTEGRATION_SKILL } from '@muirouter/shared-db/integration-guide';

export async function GET(_request: Request, context: { params: Promise<{ version: string }> }) {
  const { version } = await context.params;
  if (version !== INTEGRATION_VERSION) return new Response('找不到此接入版本', { status: 404 });
  return new Response(INTEGRATION_SKILL, {
    headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable' },
  });
}
