import { describe, expect, it } from 'vitest';
import type { BlogPost, BlogPostTranslation } from '@/db/app-schema';
import { toLocalizedBlogPost, toPublishedLocalizedBlogPosts } from './blog';

function makePost(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    slug: 'codex-context-drift',
    publishedAt: '2026-07-02',
    sourcePublishedAt: '2026-06-28',
    readingMinutes: 4,
    status: 'published',
    createdAt: new Date('2026-07-02T00:00:00.000Z'),
    updatedAt: new Date('2026-07-02T00:00:00.000Z'),
    ...overrides,
  };
}

function makeTranslation(overrides: Partial<BlogPostTranslation> = {}): BlogPostTranslation {
  return {
    slug: 'codex-context-drift',
    locale: 'en',
    title: 'Codex Getting Worse Is Not Magic',
    description: 'Reduce errors, then reset context.',
    tagsJson: '["Codex","AI coding"]',
    sourcesJson: '[{"label":"Linux.do","url":"https://linux.do/t/topic/2490104"}]',
    ...overrides,
  };
}

describe('blog metadata helpers', () => {
  it('converts D1 rows to a localized blog post', () => {
    const post = toLocalizedBlogPost(makePost(), [makeTranslation()], 'en');

    expect(post).toEqual({
      slug: 'codex-context-drift',
      href: '/blog/codex-context-drift',
      title: 'Codex Getting Worse Is Not Magic',
      description: 'Reduce errors, then reset context.',
      publishedAt: '2026-07-02',
      sourcePublishedAt: '2026-06-28',
      readingMinutes: 4,
      tags: ['Codex', 'AI coding'],
      sources: [{ label: 'Linux.do', url: 'https://linux.do/t/topic/2490104' }],
    });
  });

  it('falls back to English metadata when the requested locale is missing', () => {
    const post = toLocalizedBlogPost(makePost(), [makeTranslation()], 'fr');

    expect(post?.title).toBe('Codex Getting Worse Is Not Magic');
  });

  it('filters unpublished posts before localization', () => {
    const posts = [makePost(), makePost({ slug: 'draft-post', status: 'draft' })];
    const translations = [makeTranslation(), makeTranslation({ slug: 'draft-post', title: 'Draft' })];

    expect(toPublishedLocalizedBlogPosts(posts, translations, 'en')).toHaveLength(1);
    expect(toPublishedLocalizedBlogPosts(posts, translations, 'en')[0]?.slug).toBe('codex-context-drift');
  });

  it('uses empty tags and sources when JSON metadata is malformed', () => {
    const post = toLocalizedBlogPost(
      makePost(),
      [
        makeTranslation({
          tagsJson: 'not json',
          sourcesJson: '[{"label":"missing url"}]',
        }),
      ],
      'en',
    );

    expect(post?.tags).toEqual([]);
    expect(post?.sources).toEqual([]);
  });
});
