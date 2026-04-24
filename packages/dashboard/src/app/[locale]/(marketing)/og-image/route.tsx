import { ImageResponse } from 'next/og';
import { MarketingOgImage } from '@/components/marketing-og-image';
import { MARKETING_OG_IMAGE_SIZE } from '@/lib/seo';

export const runtime = 'edge';

export function GET() {
  return new ImageResponse(<MarketingOgImage />, { ...MARKETING_OG_IMAGE_SIZE });
}
