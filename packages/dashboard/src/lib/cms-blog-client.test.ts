import { describe, expect, it, vi } from 'vitest';
import { listPublishedCmsBlogDocuments, parseCmsBlogDocument, parseCmsBlogDocuments } from './cms-blog-client';

function makeArticleDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    site: 'muirouter',
    locale: 'en',
    title: 'GPT-5.6 is now generally available',
    slug: 'gpt-5-6',
    status: 'published',
    summary: 'Pricing and benchmark notes for the GPT-5.6 family.',
    bodyMarkdown: '# GPT-5.6\n\nBody text.',
    tags: [{ value: 'GPT' }, { value: '调价' }],
    keywords: [{ value: 'gpt-5-6' }],
    sources: [{ label: 'OpenAI', url: 'https://openai.com/blog' }],
    readingMinutes: 4,
    sourcePublishedAt: '2026-07-09T00:00:00.000Z',
    publishedAt: '2026-07-10T00:00:00.000Z',
    ...overrides,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

describe('parseCmsBlogDocument', () => {
  it('映射 CMS 字段为站点形状，并转换 locale 与日期', () => {
    const doc = parseCmsBlogDocument(makeArticleDoc({ locale: 'zh-CN' }));

    expect(doc).toEqual({
      slug: 'gpt-5-6',
      locale: 'zh',
      title: 'GPT-5.6 is now generally available',
      description: 'Pricing and benchmark notes for the GPT-5.6 family.',
      bodyMarkdown: '# GPT-5.6\n\nBody text.',
      tags: ['GPT', '调价'],
      sources: [{ label: 'OpenAI', url: 'https://openai.com/blog' }],
      sourcePublishedAt: '2026-07-09',
      readingMinutes: 4,
      publishedAt: '2026-07-10',
    });
  });

  it('缺失的 readingMinutes 与 sourcePublishedAt 落为 null', () => {
    const doc = parseCmsBlogDocument(
      makeArticleDoc({ readingMinutes: undefined, sourcePublishedAt: undefined, tags: undefined, sources: undefined }),
    );

    expect(doc?.readingMinutes).toBeNull();
    expect(doc?.sourcePublishedAt).toBeNull();
    expect(doc?.tags).toEqual([]);
    expect(doc?.sources).toEqual([]);
  });

  it('拒收草稿、其他站点、未知 locale 与缺字段文档', () => {
    expect(parseCmsBlogDocument(makeArticleDoc({ status: 'draft' }))).toBeNull();
    expect(parseCmsBlogDocument(makeArticleDoc({ site: 'dyqr' }))).toBeNull();
    expect(parseCmsBlogDocument(makeArticleDoc({ locale: 'vi' }))).toBeNull();
    expect(parseCmsBlogDocument(makeArticleDoc({ slug: '' }))).toBeNull();
    expect(parseCmsBlogDocument(makeArticleDoc({ publishedAt: 'not-a-date' }))).toBeNull();
    expect(parseCmsBlogDocument(null)).toBeNull();
    expect(parseCmsBlogDocument('text')).toBeNull();
  });
});

describe('parseCmsBlogDocuments', () => {
  it('按发布日期倒序排序并过滤非法文档', () => {
    const docs = parseCmsBlogDocuments({
      docs: [
        makeArticleDoc({ slug: 'old-post', publishedAt: '2026-06-01T00:00:00.000Z' }),
        makeArticleDoc({ slug: 'draft-post', status: 'draft' }),
        makeArticleDoc(),
      ],
    });

    expect(docs.map((doc) => doc.slug)).toEqual(['gpt-5-6', 'old-post']);
  });

  it('非列表响应返回空数组', () => {
    expect(parseCmsBlogDocuments(null)).toEqual([]);
    expect(parseCmsBlogDocuments({ docs: 'nope' })).toEqual([]);
    expect(parseCmsBlogDocuments({})).toEqual([]);
  });
});

describe('listPublishedCmsBlogDocuments', () => {
  it('按 site=muirouter 过滤拉取并解析结果', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ docs: [makeArticleDoc()] }));

    const docs = await listPublishedCmsBlogDocuments(fetchMock);

    expect(docs).toHaveLength(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url.startsWith('https://cms.muicv.com/api/articles?')).toBe(true);
    expect(url).toContain('where%5Bsite%5D%5Bequals%5D=muirouter');
    expect(url).toContain('where%5Bstatus%5D%5Bequals%5D=published');
  });

  it('CMS 不可达时返回空数组而不是抛错', async () => {
    const serverError = vi.fn().mockResolvedValue(jsonResponse({ message: 'boom' }, 500));
    await expect(listPublishedCmsBlogDocuments(serverError)).resolves.toEqual([]);

    const networkError = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(listPublishedCmsBlogDocuments(networkError)).resolves.toEqual([]);
  });
});
