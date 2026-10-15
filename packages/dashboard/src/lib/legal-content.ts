import type { ComponentType } from 'react';
import { type Locale, locales } from '@/i18n/config';

type LegalDoc = 'terms' | 'privacy' | 'about';
type LegalModule = { default: ComponentType };

type Loader = () => Promise<LegalModule>;

const loaders: Record<LegalDoc, Record<string, Loader>> = {
  terms: {
    en: () => import('@/content/legal/terms.mdx'),
    zh: () => import('@/content/legal/terms.zh.mdx'),
  },
  privacy: {
    en: () => import('@/content/legal/privacy.mdx'),
    zh: () => import('@/content/legal/privacy.zh.mdx'),
  },
  about: {
    en: () => import('@/content/legal/about.mdx'),
    zh: () => import('@/content/legal/about.zh.mdx'),
  },
};

/** 该法律文档真正有译文的语言（按 i18n 配置顺序，由 loader 表推导）。
 *  metadata 据此收敛 canonical / hreflang：没有译文时语言版指向英文原文。 */
export function getLegalDocLocales(doc: LegalDoc): Locale[] {
  return locales.filter((locale) => loaders[doc][locale] !== undefined);
}

export async function getLegalContent(doc: LegalDoc, locale: Locale): Promise<ComponentType> {
  const byDoc = loaders[doc];
  const loader = (byDoc[locale] as Loader | undefined) ?? byDoc.en;
  const mod = await loader();
  return mod.default;
}
