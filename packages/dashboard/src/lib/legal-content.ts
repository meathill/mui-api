import type { ComponentType } from 'react';
import type { Locale } from '@/i18n/config';

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

export async function getLegalContent(doc: LegalDoc, locale: Locale): Promise<ComponentType> {
  const byDoc = loaders[doc];
  const loader = (byDoc[locale] as Loader | undefined) ?? byDoc.en;
  const mod = await loader();
  return mod.default;
}
