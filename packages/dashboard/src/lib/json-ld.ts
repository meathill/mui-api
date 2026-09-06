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

/** BreadcrumbList：Home → [middle →] 当前页，name 通常传该页 eyebrow 文案；
 *  层级多于两级时（如 博客首页 → 文章）用 middle 传入中间节点。 */
export function buildBreadcrumbEntity(
  path: string,
  locale: string,
  name: string,
  middle?: { name: string; path: string },
) {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error('Breadcrumb name 不能为空');
  }

  const itemListElement: Array<{ '@type': string; position: number; name: string; item: string }> = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}${getLocalizedPath('/', locale)}` },
  ];
  if (middle?.name.trim()) {
    itemListElement.push({
      '@type': 'ListItem',
      position: 2,
      name: middle.name.trim(),
      item: `${SITE_URL}${getLocalizedPath(middle.path, locale)}`,
    });
  }
  itemListElement.push({
    '@type': 'ListItem',
    position: itemListElement.length + 1,
    name: normalizedName,
    item: `${SITE_URL}${getLocalizedPath(path, locale)}`,
  });

  return {
    '@type': 'BreadcrumbList',
    itemListElement,
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
