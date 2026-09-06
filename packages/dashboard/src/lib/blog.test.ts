import { describe, expect, it } from 'vitest';
import type { CmsBlogDocument } from './cms-blog-client';
import { pickDocumentForLocale, toLocalizedBlogPost } from './blog';

function makeDocument(overrides: Partial<CmsBlogDocument> = {}): CmsBlogDocument {
  return {
    slug: 'codex-context-drift',
    locale: 'en',
    title: 'Codex Getting Worse Is Not Magic',
    description: 'Reduce errors, then reset context.',
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
      title: 'Codex Getting Worse Is Not Magic',
      description: 'Reduce errors, then reset context.',
      publishedAt: '2026-07-02',
      sourcePublishedAt: '2026-06-28',
      readingMinutes: 4,
      tags: ['Codex', 'AI coding'],
      sources: [{ label: 'Linux.do', url: 'https://linux.do/t/topic/2490104' }],
    });
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
});
