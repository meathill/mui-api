import { describe, expect, it } from 'vitest';
import { defaultLocale, locales } from '@/i18n/config';
import {
  buildMetadata,
  getBlogPostOgImage,
  getLanguageAlternates,
  getLocalizedPath,
  getMarketingOgImage,
  getResolvedLocale,
  SITE_NAME,
  SITE_URL,
} from './seo';

describe('getLocalizedPath', () => {
  it('默认语言不加前缀', () => {
    expect(getLocalizedPath('/pricing', defaultLocale)).toBe('/pricing');
    expect(getLocalizedPath('/', defaultLocale)).toBe('/');
  });

  it('非默认语言加 locale 前缀', () => {
    expect(getLocalizedPath('/pricing', 'zh')).toBe('/zh/pricing');
  });

  it('根路径为 /zh 而非 /zh/，避免 Next.js 308 重定向', () => {
    expect(getLocalizedPath('/', 'zh')).toBe('/zh');
  });
});

describe('getLanguageAlternates', () => {
  it('覆盖全部语言并附带 x-default', () => {
    const alternates = getLanguageAlternates('/pricing');
    for (const locale of locales) {
      expect(alternates[locale]).toBe(getLocalizedPath('/pricing', locale));
    }
    expect(alternates['x-default']).toBe('/pricing');
  });
});

describe('getResolvedLocale', () => {
  it('合法 locale 原样返回', () => {
    expect(getResolvedLocale('ja')).toBe('ja');
  });

  it('非法 locale 回退到默认语言', () => {
    expect(getResolvedLocale('xx')).toBe(defaultLocale);
    expect(getResolvedLocale('')).toBe(defaultLocale);
  });
});

describe('getMarketingOgImage / getBlogPostOgImage', () => {
  it('默认语言的 OG 图不带 locale 前缀', () => {
    expect(getMarketingOgImage(defaultLocale).url).toBe(`${SITE_URL}/og-image`);
  });

  it('非默认语言的 OG 图带 locale 前缀', () => {
    expect(getMarketingOgImage('de').url).toBe(`${SITE_URL}/de/og-image`);
  });

  it('博客 OG 图按 slug 与 locale 拼接完整 URL', () => {
    expect(getBlogPostOgImage('hello-world', 'zh').url).toBe(`${SITE_URL}/zh/blog/hello-world/og-image`);
    expect(getBlogPostOgImage('hello-world', defaultLocale).url).toBe(`${SITE_URL}/blog/hello-world/og-image`);
  });
});

describe('buildMetadata', () => {
  const baseOptions = {
    path: '/pricing',
    title: '标题',
    description: '描述',
    locale: 'zh',
  };

  it('canonical 与 OG url 一致且本地化', () => {
    const metadata = buildMetadata(baseOptions);
    expect(metadata.alternates?.canonical).toBe('/zh/pricing');
    expect(metadata.openGraph?.url).toBe('/zh/pricing');
  });

  it('hreflang 基于未本地化的 path 生成', () => {
    const metadata = buildMetadata(baseOptions);
    expect(metadata.alternates?.languages).toEqual(getLanguageAlternates('/pricing'));
  });

  it('OG 默认 website 类型、可覆盖为 article', () => {
    expect(buildMetadata(baseOptions).openGraph).toMatchObject({ type: 'website', siteName: SITE_NAME });
    expect(buildMetadata({ ...baseOptions, ogType: 'article' }).openGraph).toMatchObject({ type: 'article' });
  });

  it('twitter 卡片复用 OG 图 URL', () => {
    const metadata = buildMetadata(baseOptions);
    expect(metadata.twitter?.images).toEqual([getMarketingOgImage('zh').url]);
  });

  it('默认不输出 robots，noindex 时输出 index/follow 均为 false', () => {
    expect(buildMetadata(baseOptions).robots).toBeUndefined();
    expect(buildMetadata({ ...baseOptions, noindex: true }).robots).toEqual({ index: false, follow: false });
  });
});
