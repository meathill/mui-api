import { describe, expect, it } from 'vitest';
import { ImageResponse } from 'next/og';
import { createBlogOgImage } from '@/components/blog-og-image';
import { MARKETING_OG_IMAGE_SIZE } from '@/lib/seo';
import { createOgEtag, matchesEtag, materializeOgResponse } from './og-cache';

describe('OG image cache helpers', () => {
  it('为同一内容生成稳定 ETag，并在内容变化时更新', () => {
    expect(createOgEtag(['zh', 'post', '标题'])).toBe(createOgEtag(['zh', 'post', '标题']));
    expect(createOgEtag(['zh', 'post', '标题'])).not.toBe(createOgEtag(['zh', 'post', '新标题']));
  });

  it('识别 If-None-Match 中的精确 ETag 与通配符', () => {
    const etag = createOgEtag(['marketing', 'v1']);
    expect(matchesEtag(`"other", ${etag}`, etag)).toBe(true);
    expect(matchesEtag('*', etag)).toBe(true);
    expect(matchesEtag('"other"', etag)).toBe(false);
  });

  it('将流式图片响应物化为保留状态和响应头的普通响应', async () => {
    const response = await materializeOgResponse(
      new Response(new Uint8Array([137, 80, 78, 71]), {
        headers: { 'Content-Type': 'image/png', ETag: '"og-test"' },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('etag')).toBe('"og-test"');
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([137, 80, 78, 71]);
  });

  it('将博客标题渲染为带稳定缓存头的 PNG', async () => {
    const etag = createOgEtag(['en', 'post', 'A cached blog title']);
    const response = await materializeOgResponse(
      new ImageResponse(createBlogOgImage('A cached blog title'), {
        ...MARKETING_OG_IMAGE_SIZE,
        headers: { 'Cache-Control': 'public, s-maxage=2592000', ETag: etag },
      }),
    );
    const body = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('image/png');
    expect(response.headers.get('etag')).toBe(etag);
    expect(response.headers.get('cache-control')).toContain('s-maxage=2592000');
    expect(Array.from(body.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });
});
