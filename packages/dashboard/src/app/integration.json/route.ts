import { API_BASE_URL, INTEGRATION_VERSION } from '@muirouter/shared-db/integration';

export function GET() {
  return Response.json({
    version: INTEGRATION_VERSION,
    apiBaseUrl: API_BASE_URL,
    mcpUrl: `${API_BASE_URL}/mcp`,
    skillUrl: 'https://muirouter.com/skill.md',
    cliPackage: '@muirouter/cli',
    cliVersion: INTEGRATION_VERSION,
  });
}
