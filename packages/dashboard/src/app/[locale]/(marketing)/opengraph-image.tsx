import { ImageResponse } from 'next/og';
import { MarketingOgImage } from '@/components/marketing-og-image';
import { MARKETING_OG_IMAGE_ALT, MARKETING_OG_IMAGE_SIZE } from '@/lib/seo';

export const runtime = 'edge';
export const alt = MARKETING_OG_IMAGE_ALT;
export const size = MARKETING_OG_IMAGE_SIZE;
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(<MarketingOgImage />, { ...size });
}
