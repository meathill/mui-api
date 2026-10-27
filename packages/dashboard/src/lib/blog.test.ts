import { describe, expect, it } from 'vitest';
import type { CmsBlogDocument } from './cms-blog-client';
import { getBlogCacheVersion, getDocumentLocales, pickDocumentForLocale, toLocalizedBlogPost } from './blog';

function makeDocument(overrides: Partial<CmsBlogDocument> = {}): CmsBlogDocument {
  return {
    slug: 'codex-context-drift',
    locale: 'en',
    title: 'Codex Getting Worse Is Not Magic',
    description: 'Reduce errors, then reset context.',
    seoTitle: 'Codex Getting Worse Is Not Magic',
    seoDescription:
      'Why Codex output drifts and how reducing errors, then resetting context, keeps long agent runs usable.',
    bodyMarkdown: 'Body text for the article.',
    tags: ['Codex', 'AI coding'],
    sources: [{ label: 'Linux.do', url: 'https://linux.do/t/topic/2490104' }],
    sourcePublishedAt: '2026-06-28',
    readingMinutes: 4,
    publishedAt: '2026-07-02',
    ...overrides,
  };
}

describe('blog metadata helpers', () => {
  it('converts a CMS document to a localized blog post', () => {
    const post = toLocalizedBlogPost(makeDocument());

    expect(post).toEqual({
      slug: 'codex-context-drift',
      href: '/blog/codex-context-drift',
      documentLocale: 'en',
      availableLocales: ['en'],
      title: 'Codex Getting Worse Is Not Magic',
      description: 'Reduce errors, then reset context.',
      seoTitle: 'Codex Getting Worse Is Not Magic',
      seoDescription:
        'Why Codex output drifts and how reducing errors, then resetting context, keeps long agent runs usable.',
      publishedAt: '2026-07-02',
      sourcePublishedAt: '2026-06-28',
      readingMinutes: 4,
      tags: ['Codex', 'AI coding'],
      sources: [{ label: 'Linux.do', url: 'https://linux.do/t/topic/2490104' }],
    });
  });

  it('availableLocales 记录真正有译文的语言，按 i18n 配置顺序排列', () => {
    const group = [makeDocument({ locale: 'ja' }), makeDocument({ locale: 'zh' }), makeDocument({ locale: 'en' })];

    expect(getDocumentLocales(group)).toEqual(['en', 'zh', 'ja']);
    expect(toLocalizedBlogPost(group[1], getDocumentLocales(group)).availableLocales).toEqual(['en', 'zh', 'ja']);
  });

  it('getDocumentLocales 去重同语言文档（CMS 可能有多稿）', () => {
    const group = [makeDocument({ locale: 'zh' }), makeDocument({ locale: 'zh' })];

    expect(getDocumentLocales(group)).toEqual(['zh']);
  });

  it('falls back to publishedAt and estimates reading minutes when CMS omits them', () => {
    const english = makeDocument({ sourcePublishedAt: null, readingMinutes: null });
    const chinese = makeDocument({
      sourcePublishedAt: null,
      readingMinutes: null,
      bodyMarkdown: '这是一段中文正文。'.repeat(80),
    });

    expect(toLocalizedBlogPost(english).sourcePublishedAt).toBe('2026-07-02');
    expect(toLocalizedBlogPost(english).readingMinutes).toBe(1);
    expect(toLocalizedBlogPost(chinese).readingMinutes).toBe(2);
  });

  it('picks the requested locale, then falls back to English, then to the first available', () => {
    const group = [makeDocument({ locale: 'zh' }), makeDocument({ locale: 'ja' })];

    expect(pickDocumentForLocale(group, 'zh')?.locale).toBe('zh');
    expect(pickDocumentForLocale(group, 'fr')?.locale).toBe('zh');
    expect(pickDocumentForLocale([makeDocument({ locale: 'ja' })], 'fr')?.locale).toBe('ja');
    expect(pickDocumentForLocale([], 'en')).toBeNull();
  });

  it('toLocalizedBlogPost 保留实际命中文档的语言，供详情页显示原文提示条', () => {
    const zhOnly = toLocalizedBlogPost(makeDocument({ locale: 'zh' }));
    expect(zhOnly.documentLocale).toBe('zh');
    // en 请求回退命中 zh 文档时，documentLocale 与请求 locale 不同 → 详情页提示「暂无译文」
    expect(pickDocumentForLocale([makeDocument({ locale: 'zh' })], 'en')?.locale).toBe('zh');
  });

  describe('getBlogCacheVersion', () => {
    it('优先从 process.env.BLOG_CACHE_VERSION 读取', async () => {
      const original = process.env.BLOG_CACHE_VERSION;
      process.env.BLOG_CACHE_VERSION = 'v-custom-123';
      try {
        expect(await getBlogCacheVersion()).toBe('v-custom-123');
      } finally {
        process.env.BLOG_CACHE_VERSION = original;
      }
    });

    it('无自定义环境变量时回退到默认版本 v4', async () => {
      const originalBlog = process.env.BLOG_CACHE_VERSION;
      delete (process.env as Record<string, string | undefined>).BLOG_CACHE_VERSION;
      try {
        expect(await getBlogCacheVersion()).toBe('v4');
      } finally {
        (process.env as Record<string, string | undefined>).BLOG_CACHE_VERSION = originalBlog;
      }
    });
  });
});
