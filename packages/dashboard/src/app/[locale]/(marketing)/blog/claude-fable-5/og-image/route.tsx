import { ImageResponse } from 'next/og';
import { BlogOgImage } from '@/components/blog-og-image';
import { routing } from '@/i18n/routing';
import { getBlogPost, getLocalizedBlogPost } from '@/lib/blog';
import { getResolvedLocale, MARKETING_OG_IMAGE_SIZE } from '@/lib/seo';

const POST_SLUG = 'claude-fable-5';

// 注意：不要设置 runtime = 'edge'。@opennextjs/cloudflare 不支持 Edge Runtime，
// next/og 仅在默认的 Node.js runtime 下可用，设为 edge 会导致线上 500。

// Route Handler 不会像 page.tsx 一样自动继承祖先 layout 的 generateStaticParams，
// 必须在这里单独声明，否则该路由永远被判定为动态、每次请求都重新渲染且不缓存。
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const dynamic = 'force-static';

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const post = getBlogPost(POST_SLUG);
  if (!post) {
    throw new Error(`Blog post not found: ${POST_SLUG}`);
  }

  const localizedPost = getLocalizedBlogPost(post, getResolvedLocale(locale));
  return new ImageResponse(<BlogOgImage title={localizedPost.title} />, { ...MARKETING_OG_IMAGE_SIZE });
}
