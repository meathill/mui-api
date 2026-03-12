import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createAuth } from '@/lib/auth';

async function handleAuthRequest(request: Request) {
  const { env } = await getCloudflareContext();
  const auth = createAuth(env.DB, {
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
  });
  return auth.handler(request);
}

export async function GET(request: Request) {
  return handleAuthRequest(request);
}

export async function POST(request: Request) {
  return handleAuthRequest(request);
}
