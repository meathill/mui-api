import { ImageResponse } from 'next/og';
import { connection } from 'next/server';
import { createBlogOgImage } from '@/components/blog-og-image';
import { getLocalizedBlogPost } from '@/lib/blog';
import { createOgEtag, matchesEtag, materializeOgResponse, OG_CACHE_CONTROL } from '@/lib/og-cache';
import { getResolvedLocale, MARKETING_OG_IMAGE_SIZE } from '@/lib/seo';

// 注意：不要设置 runtime = 'edge'。@opennextjs/cloudflare 不支持 Edge Runtime，
// next/og 仅在默认的 Node.js runtime 下可用，设为 edge 会导致线上 500。
export async function GET(request: Request, { params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;

  await connection();
  const localizedPost = await getLocalizedBlogPost(slug, getResolvedLocale(locale));
  if (!localizedPost) {
    return new Response('Not found', { status: 404 });
  }

  const etag = createOgEtag([locale, slug, localizedPost.title]);
  if (matchesEtag(request.headers.get('if-none-match'), etag)) {
    return new Response(null, {
      status: 304,
      headers: { 'Cache-Control': OG_CACHE_CONTROL, ETag: etag },
    });
  }

  return materializeOgResponse(
    new ImageResponse(createBlogOgImage(localizedPost.title), {
      ...MARKETING_OG_IMAGE_SIZE,
      headers: { 'Cache-Control': OG_CACHE_CONTROL, ETag: etag },
    }),
  );
}
