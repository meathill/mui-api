import { getAuth } from '@/lib/auth';
import { withTiming } from '@/lib/request-timing';

async function handleAuthRequest(request: Request): Promise<Response> {
  const auth = await getAuth();
  // pathname 不含 query，避免泄露 OAuth code/state
  const pathname = new URL(request.url).pathname;
  return withTiming(`${request.method} ${pathname}`, () => auth.handler(request));
}

export async function GET(request: Request) {
  return handleAuthRequest(request);
}

export async function POST(request: Request) {
  return handleAuthRequest(request);
}
