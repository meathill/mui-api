import { describe, expect, it } from 'vitest';
import { extractUrlsFromSitemap, INDEXNOW_HOST, INDEXNOW_KEY_LOCATION, SITE_URL } from './indexnow.ts';

describe('extractUrlsFromSitemap', () => {
  it('空字符串返回空数组', () => {
    expect(extractUrlsFromSitemap('')).toEqual([]);
  });

  it('sitemap 没有 url 条目时返回空数组', () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n';
    expect(extractUrlsFromSitemap(xml)).toEqual([]);
  });

  it('按文档顺序提取多个 loc', () => {
    const xml = [
      '<urlset>',
      '<url><loc>https://muirouter.com/</loc></url>',
      '<url><loc>https://muirouter.com/blog/gpt-5-5</loc></url>',
      '<url><loc>https://muirouter.com/zh/blog/gpt-5-5</loc></url>',
      '</urlset>',
    ].join('\n');
    expect(extractUrlsFromSitemap(xml)).toEqual([
      'https://muirouter.com/',
      'https://muirouter.com/blog/gpt-5-5',
      'https://muirouter.com/zh/blog/gpt-5-5',
    ]);
  });

  it('不会把 hreflang alternate 的 href 属性误抓成 URL', () => {
    const xml = [
      '<urlset xmlns:xhtml="http://www.w3.org/1999/xhtml">',
      '<url>',
      '<loc>https://muirouter.com/blog/gpt-5-5</loc>',
      '<xhtml:link rel="alternate" hreflang="x-default" href="https://muirouter.com/blog/gpt-5-5" />',
      '<xhtml:link rel="alternate" hreflang="zh" href="https://muirouter.com/zh/blog/gpt-5-5" />',
      '</url>',
      '</urlset>',
    ].join('\n');
    expect(extractUrlsFromSitemap(xml)).toEqual(['https://muirouter.com/blog/gpt-5-5']);
  });
});

describe('IndexNow 常量', () => {
  it('host 与 keyLocation 均从 SITE_URL 派生', () => {
    expect(INDEXNOW_HOST).toBe('muirouter.com');
    expect(INDEXNOW_KEY_LOCATION).toBe(`${SITE_URL}/016b4167fcb47ccc6332fc9ab8a242ab.txt`);
  });
});
