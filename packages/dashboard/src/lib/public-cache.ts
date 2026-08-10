/**
 * 公共内容（blog、pricing）的 D1 查询缓存策略。
 *
 * 用 `unstable_cache` 而非 `'use cache'`：后者需要 `cacheComponents`，
 * 而 Cache Components 在 workerd 上会让 request-time 渲染挂死，详见 DEV_NOTE.md。
 */
export const PUBLIC_CONTENT_REVALIDATE_SECONDS = 86_400;

export const BLOG_CONTENT_TAG = 'blog-content';

export const PRICING_MODELS_TAG = 'pricing-models';
