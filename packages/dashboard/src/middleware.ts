import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { isCrawlerUserAgent } from './lib/crawler';

const handleI18nRouting = createMiddleware(routing);

// 爬虫：关闭语言探测（NEXT_LOCALE cookie / accept-language）且不下发 NEXT_LOCALE cookie，
// 每个 URL 都按路径前缀解析语言并直接 200，避免 cookie 触发 307 让爬虫拿不到当前 URL。
// 路径级规范化（如 /en/xxx → /xxx）仍然保留。
const handleCrawlerI18nRouting = createMiddleware({
  ...routing,
  localeDetection: false,
  localeCookie: false,
});

export default function middleware(request: NextRequest) {
  if (isCrawlerUserAgent(request.headers.get('user-agent'))) {
    return handleCrawlerI18nRouting(request);
  }
  return handleI18nRouting(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
