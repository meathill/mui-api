import { ImageResponse } from 'next/og';
import { BlogOgImage } from '@/components/blog-og-image';
import { getLocalizedBlogPost } from '@/lib/blog';
import { hasBlogContent } from '@/lib/blog-content';
import { getResolvedLocale, MARKETING_OG_IMAGE_SIZE } from '@/lib/seo';

export const dynamic = 'force-dynamic';

// 注意：不要设置 runtime = 'edge'。@opennextjs/cloudflare 不支持 Edge Runtime，
// next/og 仅在默认的 Node.js runtime 下可用，设为 edge 会导致线上 500。
export async function GET(_request: Request, { params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const localizedPost = await getLocalizedBlogPost(slug, getResolvedLocale(locale));
  if (!localizedPost || !hasBlogContent(slug)) {
    return new Response('Not found', { status: 404 });
  }

  return new ImageResponse(<BlogOgImage title={localizedPost.title} />, { ...MARKETING_OG_IMAGE_SIZE });
}
