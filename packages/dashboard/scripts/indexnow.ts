/**
 * IndexNow 提交所需的常量与纯函数。
 *
 * 本文件会被 packages/dashboard/scripts/submit-indexnow.ts 用纯 node 执行
 * （node scripts/submit-indexnow.ts）。Node 原生运行 .ts 文件不解析 tsconfig
 * 的 @/* 路径别名，所以这里不 import src/lib/seo.ts（它依赖 @/i18n/config），
 * SITE_URL 直接硬编码——与 src/app/robots.ts 里 sitemap 字段硬编码
 * https://muirouter.com 是同样的取舍，不是新引入的不一致。
 */

export const SITE_URL = 'https://muirouter.com';
export const INDEXNOW_KEY = '016b4167fcb47ccc6332fc9ab8a242ab';
export const INDEXNOW_HOST = new URL(SITE_URL).hostname;
export const INDEXNOW_KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
export const DEFAULT_SITEMAP_URL = `${SITE_URL}/sitemap.xml`;
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const INDEXNOW_MAX_URLS_PER_REQUEST = 10_000;

export function extractUrlsFromSitemap(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1].trim());
}
