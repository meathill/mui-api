import { INTEGRATION_SKILL } from '@muirouter/shared-db/integration-guide';
import { INTEGRATION_VERSION } from '@muirouter/shared-db/integration';

export function GET() {
  return new Response(INTEGRATION_SKILL, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=300',
      etag: `"muirouter-skill-${INTEGRATION_VERSION}"`,
    },
  });
}
