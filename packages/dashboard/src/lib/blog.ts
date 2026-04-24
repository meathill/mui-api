export type BlogSource = {
  label: string;
  url: string;
};

export type BlogPost = {
  slug: string;
  href: string;
  title: string;
  description: string;
  publishedAt: string;
  sourcePublishedAt: string;
  readingMinutes: number;
  tags: readonly string[];
  sources: readonly BlogSource[];
};

export const BLOG_POSTS = [
  {
    slug: 'gpt-5-5',
    href: '/blog/gpt-5-5',
    title: "GPT-5.5 Is Here: OpenAI's New Work Model Changes What AI Can Do for You",
    description:
      'OpenAI has released GPT-5.5 for ChatGPT and Codex, with stronger agentic coding, computer use, knowledge work, and research capabilities. Here is what changed and how to prepare for API access.',
    publishedAt: '2026-04-24',
    sourcePublishedAt: '2026-04-23',
    readingMinutes: 7,
    tags: ['GPT-5.5', 'OpenAI', 'AI models'],
    sources: [
      {
        label: 'OpenAI GPT-5.5 announcement',
        url: 'https://openai.com/index/introducing-gpt-5-5/',
      },
      {
        label: 'GPT-5.5 System Card',
        url: 'https://openai.com/index/gpt-5-5-system-card/',
      },
      {
        label: 'GPT-5.3 and GPT-5.5 in ChatGPT',
        url: 'https://help.openai.com/en/articles/11909943-gpt-53-and-gpt-54-in-chatgpt',
      },
      {
        label: 'OpenAI API Pricing',
        url: 'https://openai.com/api/pricing/',
      },
    ],
  },
] as const satisfies readonly BlogPost[];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
