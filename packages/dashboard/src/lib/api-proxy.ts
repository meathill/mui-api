import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * 代理请求到 API Worker 的 admin 端点
 * 服务端使用，自动附加 ADMIN_SECRET
 */
export async function proxyToApi(path: string, options: RequestInit = {}): Promise<Response> {
  const { env } = await getCloudflareContext();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || '';
  const adminSecret = env.ADMIN_SECRET;

  return fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': adminSecret,
      ...options.headers,
    },
  });
}
