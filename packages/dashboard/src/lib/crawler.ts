/**
 * 搜索引擎 / AI 爬虫 User-Agent 识别。
 *
 * 用途：middleware 对爬虫关闭 next-intl 的 cookie / accept-language 语言跳转，
 * 让爬虫对任意 URL 都拿到该 URL 本身（200），而不是被 NEXT_LOCALE cookie 307 到别的语言版本。
 * 普通用户不受影响。宁可漏判（漏判=维持现状），不要误判真人浏览器。
 */
const CRAWLER_USER_AGENT_PATTERN = new RegExp(
  [
    // 通用关键词：绝大多数爬虫 UA 带 bot / crawler / spider / slurp
    'bot\\b',
    'crawler',
    'spider',
    'slurp',
    // 不带上述关键词的常见爬虫 / 链接预览抓取器（只收录专用抓取器，不收录同名的真人浏览器/App UA，
    // 如 YandexSearch、DuckDuckGo 浏览器、Sogou 浏览器）
    'mediapartners-google',
    'adsbot-google',
    'google-inspectiontool',
    'googleother',
    'bingpreview',
    'facebookexternalhit',
    'meta-externalagent',
    'whatsapp/',
    'embedly',
    'oai-searchbot',
    'chatgpt-user',
    'claude-web',
    'claude-user',
    'anthropic-ai',
    'perplexity-user',
    'cohere-ai',
    'ia_archiver',
  ].join('|'),
  'i',
);

// 含 bot 字样的真人设备 UA（如 Cubot 手机），避免被通用关键词误判
const HUMAN_USER_AGENT_EXCEPTION_PATTERN = /cubot/i;

export function isCrawlerUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  if (HUMAN_USER_AGENT_EXCEPTION_PATTERN.test(userAgent)) return false;
  return CRAWLER_USER_AGENT_PATTERN.test(userAgent);
}
