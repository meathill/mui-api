import { getLocalizedPath, SITE_URL } from './seo';

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface ItemListEntry {
  name: string;
  url?: string;
}

/** FAQPage 结构化数据实体，用于拼进页面的 @graph 数组 */
export function buildFaqEntity(faq: FaqEntry[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

/** BreadcrumbList：Home → 当前页，name 通常传该页 eyebrow 文案 */
export function buildBreadcrumbEntity(path: string, locale: string, name: string) {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error('Breadcrumb name 不能为空');
  }

  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}${getLocalizedPath('/', locale)}` },
      { '@type': 'ListItem', position: 2, name: normalizedName, item: `${SITE_URL}${getLocalizedPath(path, locale)}` },
    ],
  };
}

/** ItemList：listicle 页面的榜单条目，position 按数组下标 + 1 */
export function buildItemListEntity(items: ItemListEntry[]) {
  return {
    '@type': 'ItemList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.url ? { url: item.url } : {}),
    })),
  };
}
