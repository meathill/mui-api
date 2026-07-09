-- 新增博客文章：xAI Grok 接入公告（en/zh）。
-- 正文见 packages/dashboard/src/content/blog/xai-grok.mdx / xai-grok.zh.mdx。

INSERT OR REPLACE INTO blog_posts (slug, published_at, source_published_at, reading_minutes, status)
VALUES
  ('xai-grok', '2026-07-09', '2026-07-08', 5, 'published');

INSERT OR REPLACE INTO blog_post_translations (
  slug,
  locale,
  title,
  description,
  tags_json,
  sources_json
)
VALUES
  (
    'xai-grok',
    'en',
    'Grok 4.5 Is Here: xAI''s New Opus-Class Flagship, Now on MuiRouter',
    'xAI shipped Grok 4.5, a new flagship trained alongside Cursor and benchmarked against Claude Opus 4.8, then landed Grok on Cloudflare AI Gateway. We''ve added grok-4.5, grok-4.3, and grok-imagine-image to the MuiRouter catalog — here''s what shipped and how to start using it.',
    '["Grok 4.5","xAI","AI models"]',
    '[{"label":"xAI: Introducing Grok 4.5","url":"https://x.ai/news/grok-4-5"},{"label":"MarkTechPost: SpaceXAI releases Grok 4.5","url":"https://www.marktechpost.com/2026/07/08/spacexai-releases-grok-4-5/"},{"label":"Cloudflare AI Gateway: xAI Grok provider","url":"https://developers.cloudflare.com/ai-gateway/usage/providers/grok/"},{"label":"xAI: Grok Imagine Video 1.5","url":"https://x.ai/news/grok-imagine-video-1-5"}]'
  ),
  (
    'xai-grok',
    'zh',
    'Grok 4.5 来了：xAI 对标 Opus 的新旗舰，已接入 MuiRouter',
    'xAI 发布了 Grok 4.5——和 Cursor 联合训练、对标 Claude Opus 4.8 的新旗舰，现在 Grok 又上了 Cloudflare AI Gateway。我们已经把 grok-4.5、grok-4.3 和 grok-imagine-image 加进 MuiRouter 模型目录——这里是发布详情和上手方式。',
    '["Grok 4.5","xAI","AI 模型"]',
    '[{"label":"xAI：Grok 4.5 发布公告","url":"https://x.ai/news/grok-4-5"},{"label":"MarkTechPost：SpaceXAI 发布 Grok 4.5","url":"https://www.marktechpost.com/2026/07/08/spacexai-releases-grok-4-5/"},{"label":"Cloudflare AI Gateway：xAI Grok provider 文档","url":"https://developers.cloudflare.com/ai-gateway/usage/providers/grok/"},{"label":"xAI：Grok Imagine Video 1.5","url":"https://x.ai/news/grok-imagine-video-1-5"}]'
  );
