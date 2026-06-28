import { ImageResponse } from 'next/og';
import { MarketingOgImage } from '@/components/marketing-og-image';
import { MARKETING_OG_IMAGE_ALT, MARKETING_OG_IMAGE_SIZE } from '@/lib/seo';

// 注意：不要设置 runtime = 'edge'。@opennextjs/cloudflare 不支持 Edge Runtime，
// next/og 仅在默认的 Node.js runtime 下可用，设为 edge 会导致线上 500。
export const alt = MARKETING_OG_IMAGE_ALT;
export const size = MARKETING_OG_IMAGE_SIZE;
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(<MarketingOgImage />, { ...size });
}
