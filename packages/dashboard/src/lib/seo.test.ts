import { describe, expect, it } from 'vitest';
import { defaultLocale, locales } from '@/i18n/config';
import {
  buildMetadata,
  getBlogPostOgImage,
  getLanguageAlternates,
  getLocalizedPath,
  getMarketingOgImage,
  getPrimaryLocale,
  getResolvedLocale,
  SITE_NAME,
  SITE_URL,
  stripBrandSuffix,
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

  it('只列有译文的语言，x-default 指向主语言', () => {
    expect(getLanguageAlternates('/about', ['en', 'zh'])).toEqual({
      en: '/about',
      zh: '/zh/about',
      'x-default': '/about',
    });
  });

  it('只有中文原文时 x-default 指向中文版', () => {
    expect(getLanguageAlternates('/blog/example', ['zh'])).toEqual({
      zh: '/zh/blog/example',
      'x-default': '/zh/blog/example',
    });
  });
});

describe('getPrimaryLocale', () => {
  it('按 i18n 配置顺序取第一个有译文的语言，与入参顺序无关', () => {
    expect(getPrimaryLocale(['ja', 'zh'])).toBe('zh');
    expect(getPrimaryLocale(['zh', 'en'])).toBe('en');
    expect(getPrimaryLocale(['th'])).toBe('th');
  });

  it('没有任何译文时回退到默认语言', () => {
    expect(getPrimaryLocale([])).toBe(defaultLocale);
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

describe('stripBrandSuffix', () => {
  it('去掉 CMS 自带的各种品牌后缀，避免与 layout 模板重复', () => {
    expect(stripBrandSuffix('GPT-6 Astra 深度解析 - MuiRouter')).toBe('GPT-6 Astra 深度解析');
    expect(stripBrandSuffix('Grok 4.6 发布 | MuiRouter')).toBe('Grok 4.6 发布');
    expect(stripBrandSuffix('Kimi K3 — MuiRouter')).toBe('Kimi K3');
    expect(stripBrandSuffix('Kimi K3 - muirouter')).toBe('Kimi K3');
  });

  it('标题中间的 MuiRouter 不动（品牌是对比主体）', () => {
    expect(stripBrandSuffix('LiteLLM vs MuiRouter 对比')).toBe('LiteLLM vs MuiRouter 对比');
    expect(stripBrandSuffix('MuiRouter vs OpenRouter — 定价对比')).toBe('MuiRouter vs OpenRouter — 定价对比');
  });

  it('没有后缀时原样返回', () => {
    expect(stripBrandSuffix('GPT-6 Astra Is Here')).toBe('GPT-6 Astra Is Here');
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
  } as const;

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

  describe('translations（有译文的语言子集）', () => {
    const aboutOptions = { path: '/about', title: '标题', description: '描述' } as const;

    it('无译文的语言页 canonical / OG url 收敛到主语言版本', () => {
      const metadata = buildMetadata({ ...aboutOptions, locale: 'fr', translations: ['en', 'zh'] });

      expect(metadata.alternates?.canonical).toBe('/about');
      expect(metadata.openGraph?.url).toBe('/about');
      expect(metadata.openGraph?.locale).toBe('en');
      expect(Object.keys(metadata.alternates?.languages ?? {})).toEqual(['en', 'zh', 'x-default']);
    });

    it('有译文的语言仍然自指 canonical', () => {
      const metadata = buildMetadata({ ...aboutOptions, locale: 'zh', translations: ['en', 'zh'] });

      expect(metadata.alternates?.canonical).toBe('/zh/about');
      expect(metadata.openGraph?.locale).toBe('zh');
    });

    it('只有中文原文的博客文章，其它语言收敛到中文版', () => {
      const metadata = buildMetadata({
        path: '/blog/gpt-6-astra',
        title: '标题',
        description: '描述',
        locale: 'de',
        translations: ['zh'],
      });

      expect(metadata.alternates?.canonical).toBe('/zh/blog/gpt-6-astra');
      expect(metadata.alternates?.languages).toEqual({
        zh: '/zh/blog/gpt-6-astra',
        'x-default': '/zh/blog/gpt-6-astra',
      });
    });

    it('省略 translations 时行为与全语言页面一致', () => {
      const metadata = buildMetadata({ ...aboutOptions, locale: 'fr' });

      expect(metadata.alternates?.canonical).toBe('/fr/about');
      expect(metadata.alternates?.languages).toEqual(getLanguageAlternates('/about'));
    });
  });
});
