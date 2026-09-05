import { Hono } from 'hono';
import { API_BASE_URL, SITE_BASE_URL, CONTROL_SCOPES } from '@muirouter/shared-db/integration';

const metadata = new Hono();
metadata.get('/.well-known/oauth-authorization-server', (c) =>
  c.json({
    issuer: API_BASE_URL,
    authorization_endpoint: `${SITE_BASE_URL}/oauth/authorize`,
    token_endpoint: `${API_BASE_URL}/oauth/token`,
    revocation_endpoint: `${API_BASE_URL}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    scopes_supported: ['balance', 'llm', ...CONTROL_SCOPES],
  }),
);
metadata.get('/.well-known/oauth-protected-resource/mcp', (c) =>
  c.json({
    resource: `${API_BASE_URL}/mcp`,
    authorization_servers: [API_BASE_URL],
    scopes_supported: ['projects:read'],
    bearer_methods_supported: ['header'],
  }),
);
export default metadata;
