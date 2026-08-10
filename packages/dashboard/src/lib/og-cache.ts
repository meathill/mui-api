export const OG_CACHE_CONTROL = 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=2592000';

export function createOgEtag(parts: readonly string[]): string {
  let hash = 2_166_136_261;
  for (const character of parts.join('\u0000')) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return `"og-${(hash >>> 0).toString(16)}"`;
}

export function matchesEtag(headerValue: string | null, etag: string): boolean {
  if (!headerValue) {
    return false;
  }

  return headerValue
    .split(',')
    .map((value) => value.trim())
    .some((value) => value === '*' || value === etag);
}

export async function materializeOgResponse(response: Response): Promise<Response> {
  const body = await response.arrayBuffer();

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
