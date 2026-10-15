import { describe, expect, it } from 'vitest';
import { checkCmsSeoArticles, type CmsSeoArticle, displayWidth, listLongDescriptions } from './check-cms-seo.ts';

function makeArticle(overrides: Partial<CmsSeoArticle> = {}): CmsSeoArticle {
  return {
    slug: 'gpt-6-astra',
    locale: 'en',
    seoTitle: 'GPT-6 Astra Is Here: Pricing, Long-Context Tiers',
    seoDescription:
      'OpenAI released GPT-6 Astra with per-token pricing, long-context tiers and multi-tier routing now available through MuiRouter.',
    ...overrides,
  };
}

describe('displayWidth', () => {
  it('CJK 与全角标点按 2 计，拉丁按 1 计', () => {
    expect(displayWidth('abc')).toBe(3);
    expect(displayWidth('中文')).toBe(4);
    expect(displayWidth('AI 路由')).toBe(2 + 1 + 4);
  });
});

describe('checkCmsSeoArticles', () => {
  it('合规文档不报问题', () => {
    expect(checkCmsSeoArticles([makeArticle()])).toEqual([]);
  });

  it('标题含品牌后缀后超宽会报错', () => {
    const violations = checkCmsSeoArticles([
      makeArticle({ seoTitle: 'A Very Long Blog Post Title That Pushes The Width Over The Limit' }),
    ]);

    expect(violations).toHaveLength(1);
    expect(violations[0].field).toBe('seoTitle');
    expect(violations[0].problem).toContain('显示宽度');
  });

  it('中文标题按显示宽度判定（26 个汉字即到 64+12 上限）', () => {
    const ok = checkCmsSeoArticles([makeArticle({ seoTitle: '中文标题'.repeat(6) })]);
    expect(ok).toEqual([]);

    const tooLong = checkCmsSeoArticles([makeArticle({ seoTitle: '中文标题'.repeat(7) })]);
    expect(tooLong).toHaveLength(1);
  });

  it('标题自带品牌后缀会报错，避免与模板重复', () => {
    const violations = checkCmsSeoArticles([makeArticle({ seoTitle: 'GPT-6 Astra 深度解析 - MuiRouter' })]);

    expect(violations.map((violation) => violation.problem)).toContain('自带品牌后缀，会与页面模板重复');
  });

  it('描述过短、超上限与缺失都会报错；161–320 只进「偏长」提示', () => {
    const short = checkCmsSeoArticles([makeArticle({ seoDescription: 'Too short.' })]);
    expect(short.some((violation) => violation.problem.includes('< 120'))).toBe(true);

    const overGuard = checkCmsSeoArticles([makeArticle({ seoDescription: 'x'.repeat(321) })]);
    expect(overGuard.some((violation) => violation.problem.includes('> 320'))).toBe(true);

    const longButOk = [makeArticle({ seoDescription: 'x'.repeat(200) })];
    expect(checkCmsSeoArticles(longButOk)).toEqual([]);
    expect(listLongDescriptions(longButOk)).toHaveLength(1);

    const missing = checkCmsSeoArticles([makeArticle({ seoTitle: null, seoDescription: null })]);
    expect(missing).toHaveLength(2);
  });
});
