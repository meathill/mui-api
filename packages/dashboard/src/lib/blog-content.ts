import type { ComponentType } from 'react';
import type { Locale } from '@/i18n/config';

type BlogContentModule = {
  default: ComponentType;
};

type BlogContentLoader = () => Promise<BlogContentModule>;

const kimiK3Loaders: Record<Locale, BlogContentLoader> = {
  en: () => import('@/content/blog/kimi-k3.mdx'),
  zh: () => import('@/content/blog/kimi-k3.zh.mdx'),
  fr: () => import('@/content/blog/kimi-k3.fr.mdx'),
  es: () => import('@/content/blog/kimi-k3.es.mdx'),
  pt: () => import('@/content/blog/kimi-k3.pt.mdx'),
  de: () => import('@/content/blog/kimi-k3.de.mdx'),
  th: () => import('@/content/blog/kimi-k3.th.mdx'),
  ja: () => import('@/content/blog/kimi-k3.ja.mdx'),
};

const gpt56Loaders: Record<Locale, BlogContentLoader> = {
  en: () => import('@/content/blog/gpt-5-6.mdx'),
  zh: () => import('@/content/blog/gpt-5-6.zh.mdx'),
  fr: () => import('@/content/blog/gpt-5-6.fr.mdx'),
  es: () => import('@/content/blog/gpt-5-6.es.mdx'),
  pt: () => import('@/content/blog/gpt-5-6.pt.mdx'),
  de: () => import('@/content/blog/gpt-5-6.de.mdx'),
  th: () => import('@/content/blog/gpt-5-6.th.mdx'),
  ja: () => import('@/content/blog/gpt-5-6.ja.mdx'),
};

const gpt55Loaders: Record<Locale, BlogContentLoader> = {
  en: () => import('@/content/blog/gpt-5-5.mdx'),
  zh: () => import('@/content/blog/gpt-5-5.zh.mdx'),
  fr: () => import('@/content/blog/gpt-5-5.fr.mdx'),
  es: () => import('@/content/blog/gpt-5-5.es.mdx'),
  pt: () => import('@/content/blog/gpt-5-5.pt.mdx'),
  de: () => import('@/content/blog/gpt-5-5.de.mdx'),
  th: () => import('@/content/blog/gpt-5-5.th.mdx'),
  ja: () => import('@/content/blog/gpt-5-5.ja.mdx'),
};

const claudeOpus5Loaders: Record<Locale, BlogContentLoader> = {
  en: () => import('@/content/blog/claude-opus-5.mdx'),
  zh: () => import('@/content/blog/claude-opus-5.zh.mdx'),
  fr: () => import('@/content/blog/claude-opus-5.fr.mdx'),
  es: () => import('@/content/blog/claude-opus-5.es.mdx'),
  pt: () => import('@/content/blog/claude-opus-5.pt.mdx'),
  de: () => import('@/content/blog/claude-opus-5.de.mdx'),
  th: () => import('@/content/blog/claude-opus-5.th.mdx'),
  ja: () => import('@/content/blog/claude-opus-5.ja.mdx'),
};

const claudeSonnet5Loaders: Record<Locale, BlogContentLoader> = {
  en: () => import('@/content/blog/claude-sonnet-5.mdx'),
  zh: () => import('@/content/blog/claude-sonnet-5.zh.mdx'),
  fr: () => import('@/content/blog/claude-sonnet-5.fr.mdx'),
  es: () => import('@/content/blog/claude-sonnet-5.es.mdx'),
  pt: () => import('@/content/blog/claude-sonnet-5.pt.mdx'),
  de: () => import('@/content/blog/claude-sonnet-5.de.mdx'),
  th: () => import('@/content/blog/claude-sonnet-5.th.mdx'),
  ja: () => import('@/content/blog/claude-sonnet-5.ja.mdx'),
};

const claudeFable5Loaders: Record<Locale, BlogContentLoader> = {
  en: () => import('@/content/blog/claude-fable-5.mdx'),
  zh: () => import('@/content/blog/claude-fable-5.zh.mdx'),
  fr: () => import('@/content/blog/claude-fable-5.fr.mdx'),
  es: () => import('@/content/blog/claude-fable-5.es.mdx'),
  pt: () => import('@/content/blog/claude-fable-5.pt.mdx'),
  de: () => import('@/content/blog/claude-fable-5.de.mdx'),
  th: () => import('@/content/blog/claude-fable-5.th.mdx'),
  ja: () => import('@/content/blog/claude-fable-5.ja.mdx'),
};

const codexContextDriftLoaders: Record<Locale, BlogContentLoader> = {
  en: () => import('@/content/blog/codex-context-drift.mdx'),
  zh: () => import('@/content/blog/codex-context-drift.zh.mdx'),
  fr: () => import('@/content/blog/codex-context-drift.fr.mdx'),
  es: () => import('@/content/blog/codex-context-drift.es.mdx'),
  pt: () => import('@/content/blog/codex-context-drift.pt.mdx'),
  de: () => import('@/content/blog/codex-context-drift.de.mdx'),
  th: () => import('@/content/blog/codex-context-drift.th.mdx'),
  ja: () => import('@/content/blog/codex-context-drift.ja.mdx'),
};

const xaiGrokLoaders: Record<Locale, BlogContentLoader> = {
  en: () => import('@/content/blog/xai-grok.mdx'),
  zh: () => import('@/content/blog/xai-grok.zh.mdx'),
  fr: () => import('@/content/blog/xai-grok.fr.mdx'),
  es: () => import('@/content/blog/xai-grok.es.mdx'),
  pt: () => import('@/content/blog/xai-grok.pt.mdx'),
  de: () => import('@/content/blog/xai-grok.de.mdx'),
  th: () => import('@/content/blog/xai-grok.th.mdx'),
  ja: () => import('@/content/blog/xai-grok.ja.mdx'),
};

const gpt56PriceCutLoaders: Record<Locale, BlogContentLoader> = {
  en: () => import('@/content/blog/gpt-5-6-price-cut.mdx'),
  zh: () => import('@/content/blog/gpt-5-6-price-cut.zh.mdx'),
  fr: () => import('@/content/blog/gpt-5-6-price-cut.fr.mdx'),
  es: () => import('@/content/blog/gpt-5-6-price-cut.es.mdx'),
  pt: () => import('@/content/blog/gpt-5-6-price-cut.pt.mdx'),
  de: () => import('@/content/blog/gpt-5-6-price-cut.de.mdx'),
  th: () => import('@/content/blog/gpt-5-6-price-cut.th.mdx'),
  ja: () => import('@/content/blog/gpt-5-6-price-cut.ja.mdx'),
};

const deepseekV4FlashLoaders: Record<Locale, BlogContentLoader> = {
  en: () => import('@/content/blog/deepseek-v4-flash.mdx'),
  zh: () => import('@/content/blog/deepseek-v4-flash.zh.mdx'),
  fr: () => import('@/content/blog/deepseek-v4-flash.fr.mdx'),
  es: () => import('@/content/blog/deepseek-v4-flash.es.mdx'),
  pt: () => import('@/content/blog/deepseek-v4-flash.pt.mdx'),
  de: () => import('@/content/blog/deepseek-v4-flash.de.mdx'),
  th: () => import('@/content/blog/deepseek-v4-flash.th.mdx'),
  ja: () => import('@/content/blog/deepseek-v4-flash.ja.mdx'),
};

const grok46Loaders: Record<Locale, BlogContentLoader> = {
  en: () => import('@/content/blog/grok-4-6.mdx'),
  zh: () => import('@/content/blog/grok-4-6.zh.mdx'),
  fr: () => import('@/content/blog/grok-4-6.fr.mdx'),
  es: () => import('@/content/blog/grok-4-6.es.mdx'),
  pt: () => import('@/content/blog/grok-4-6.pt.mdx'),
  de: () => import('@/content/blog/grok-4-6.de.mdx'),
  th: () => import('@/content/blog/grok-4-6.th.mdx'),
  ja: () => import('@/content/blog/grok-4-6.ja.mdx'),
};

const deepseekV4ProLoaders: Record<Locale, BlogContentLoader> = {
  en: () => import('@/content/blog/deepseek-v4-pro.mdx'),
  zh: () => import('@/content/blog/deepseek-v4-pro.zh.mdx'),
  fr: () => import('@/content/blog/deepseek-v4-pro.fr.mdx'),
  es: () => import('@/content/blog/deepseek-v4-pro.es.mdx'),
  pt: () => import('@/content/blog/deepseek-v4-pro.pt.mdx'),
  de: () => import('@/content/blog/deepseek-v4-pro.de.mdx'),
  th: () => import('@/content/blog/deepseek-v4-pro.th.mdx'),
  ja: () => import('@/content/blog/deepseek-v4-pro.ja.mdx'),
};

const blogContentLoaders: Record<string, Record<Locale, BlogContentLoader>> = {
  'claude-fable-5': claudeFable5Loaders,
  'claude-opus-5': claudeOpus5Loaders,
  'claude-sonnet-5': claudeSonnet5Loaders,
  'codex-context-drift': codexContextDriftLoaders,
  'deepseek-v4-flash': deepseekV4FlashLoaders,
  'deepseek-v4-pro': deepseekV4ProLoaders,
  'gpt-5-5': gpt55Loaders,
  'gpt-5-6': gpt56Loaders,
  'gpt-5-6-price-cut': gpt56PriceCutLoaders,
  'grok-4-6': grok46Loaders,
  'kimi-k3': kimiK3Loaders,
  'xai-grok': xaiGrokLoaders,
};

export function hasBlogContent(slug: string): boolean {
  return slug in blogContentLoaders;
}

export async function getBlogContent(slug: string, locale: Locale): Promise<ComponentType | null> {
  const loaders = blogContentLoaders[slug];
  if (!loaders) {
    return null;
  }

  const loader = loaders[locale] ?? loaders.en;
  const { default: ArticleContent } = await loader();
  return ArticleContent;
}
