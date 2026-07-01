import { ImageResponse } from 'next/og';
import { MarketingOgImage } from '@/components/marketing-og-image';
import { routing } from '@/i18n/routing';
import { MARKETING_OG_IMAGE_SIZE } from '@/lib/seo';

// 注意：不要设置 runtime = 'edge'。@opennextjs/cloudflare 不支持 Edge Runtime，
// next/og 仅在默认的 Node.js runtime 下可用，设为 edge 会导致线上 500。

// Route Handler 不会像 page.tsx 一样自动继承祖先 layout 的 generateStaticParams
// （Next.js 内部 collectAppRouteSegments 只读取路由文件自身的导出），
// 必须在这里单独声明，否则该路由永远被判定为动态、每次请求都重新渲染且不缓存。
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const dynamic = 'force-static';

export function GET() {
  return new ImageResponse(<MarketingOgImage />, { ...MARKETING_OG_IMAGE_SIZE });
}
