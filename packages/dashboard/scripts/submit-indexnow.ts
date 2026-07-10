/**
 * 把 sitemap.xml 里的 URL 提交给 IndexNow（同时通知 Bing / Yandex / Seznam / Naver 等
 * 参与该协议的搜索引擎），用于推动 Bing 重新发现 muirouter.com 的最新 URL 集合。
 *
 * 用法:
 *   node scripts/submit-indexnow.ts [--dry-run] [--sitemap-url https://muirouter.com/sitemap.xml]
 *
 * --dry-run 只打印将要提交的 host / keyLocation / URL 数量与列表，不发起真实 POST。
 * --sitemap-url 默认读取线上 https://muirouter.com/sitemap.xml，可覆盖为本地 dev server 地址联调。
 *
 * 注意：不带 --dry-run 直接运行会向 https://api.indexnow.org/indexnow 发起真实提交，
 * 这是对外部第三方服务的、可被搜索引擎侧观测到的操作，请确认站点已部署、key 文件已可
 * 公开访问（keyLocation 返回 200）之后再执行。
 */

import {
  DEFAULT_SITEMAP_URL,
  extractUrlsFromSitemap,
  INDEXNOW_ENDPOINT,
  INDEXNOW_HOST,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  INDEXNOW_MAX_URLS_PER_REQUEST,
} from './indexnow.ts';

interface CliOptions {
  sitemapUrl: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  let sitemapUrl = DEFAULT_SITEMAP_URL;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--sitemap-url') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('参数缺少值: --sitemap-url');
      }
      sitemapUrl = next;
      index += 1;
      continue;
    }

    throw new Error(`不支持的参数: ${arg}`);
  }

  try {
    new URL(sitemapUrl);
  } catch {
    throw new Error(`--sitemap-url 不是合法的 URL: ${sitemapUrl}`);
  }

  return { sitemapUrl, dryRun };
}

async function fetchSitemapText(sitemapUrl: string): Promise<string> {
  const response = await fetch(sitemapUrl);
  if (!response.ok) {
    throw new Error(`获取 sitemap 失败 (${response.status}): ${sitemapUrl}`);
  }
  return response.text();
}

function collectUrlList(xml: string): string[] {
  const urls = extractUrlsFromSitemap(xml);
  if (urls.length === 0) {
    throw new Error('sitemap 中没有解析到任何 <loc> URL，中止提交');
  }

  const matched: string[] = [];
  const skipped: string[] = [];
  for (const url of urls) {
    if (new URL(url).hostname === INDEXNOW_HOST) {
      matched.push(url);
    } else {
      skipped.push(url);
    }
  }

  if (skipped.length > 0) {
    console.warn(`跳过 ${skipped.length} 个 host 不为 ${INDEXNOW_HOST} 的 URL：`, skipped);
  }

  if (matched.length === 0) {
    throw new Error(`过滤 host 后没有剩余 URL 可提交（期望 host: ${INDEXNOW_HOST}）`);
  }

  if (matched.length > INDEXNOW_MAX_URLS_PER_REQUEST) {
    throw new Error(
      `URL 数量 ${matched.length} 超过 IndexNow 单次请求上限 ${INDEXNOW_MAX_URLS_PER_REQUEST}，需要先实现分批提交`,
    );
  }

  return matched;
}

async function submitToIndexNow(urlList: string[]): Promise<void> {
  const body = {
    host: INDEXNOW_HOST,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList,
  };

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });

  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`IndexNow 提交失败 (${response.status}): ${await response.text()}`);
  }

  console.log(`IndexNow 提交成功，状态码 ${response.status}，共提交 ${urlList.length} 条 URL。`);
}

function printUsage(): void {
  console.log('用法:');
  console.log('  node scripts/submit-indexnow.ts [--dry-run] [--sitemap-url <url>]');
}

async function main(): Promise<void> {
  try {
    if (process.argv.includes('--help')) {
      printUsage();
      return;
    }

    const options = parseArgs(process.argv.slice(2));
    console.log(`读取 sitemap: ${options.sitemapUrl}`);
    const xml = await fetchSitemapText(options.sitemapUrl);
    const urlList = collectUrlList(xml);

    if (options.dryRun) {
      console.log('[dry-run] 不会真正发起提交，仅打印统计信息：');
      console.log(`[dry-run] host: ${INDEXNOW_HOST}`);
      console.log(`[dry-run] keyLocation: ${INDEXNOW_KEY_LOCATION}`);
      console.log(`[dry-run] endpoint: ${INDEXNOW_ENDPOINT}`);
      console.log(`[dry-run] URL 数量: ${urlList.length}`);
      for (const url of urlList.slice(0, 20)) {
        console.log(`[dry-run]   ${url}`);
      }
      if (urlList.length > 20) {
        console.log(`[dry-run]   ...(共 ${urlList.length} 条)`);
      }
      return;
    }

    await submitToIndexNow(urlList);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.log();
    printUsage();
    process.exitCode = 1;
  }
}

void main();
