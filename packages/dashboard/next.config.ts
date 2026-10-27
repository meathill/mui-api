import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import createMDX from '@next/mdx';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { sharedCloudflareStateV3Path } from '../shared-db/dev-config';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const withMDX = createMDX({
  options: {
    remarkPlugins: ['remark-gfm'],
  },
});

function resolveBlogCacheVersion(): string {
  const explicitEnv = process.env.BLOG_CACHE_VERSION?.trim();
  if (explicitEnv) return explicitEnv;

  try {
    const wranglerPath = fileURLToPath(new URL('./wrangler.jsonc', import.meta.url));
    if (fs.existsSync(wranglerPath)) {
      const content = fs.readFileSync(wranglerPath, 'utf8');
      const match = content.match(/"BLOG_CACHE_VERSION"\s*:\s*"([^"]+)"/);
      if (match && match[1]?.trim()) {
        return match[1].trim();
      }
    }
  } catch {
    // 忽略文件读取错误
  }

  return 'v4';
}

// 不要开启 cacheComponents / partialPrefetching：Next 16.3 的 Cache Components 渲染调度
// 依赖 Node 定时器语义，在 workerd 上会让所有 request-time 渲染挂死。详见 DEV_NOTE.md。
const nextConfig: NextConfig = {
  agentRules: false,
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '0.0.0',
    BLOG_CACHE_VERSION: resolveBlogCacheVersion(),
  },
  transpilePackages: ['@muirouter/shared-db'],
  async redirects() {
    return [
      // 2026-09 去重：/compare/openrouter 与 /muirouter-vs-openrouter 重复，统一到后者
      { source: '/compare/openrouter', destination: '/muirouter-vs-openrouter', permanent: true },
      // 2026-09 更名：LiteLLM 对比对象由 OpenRouter 改为 MuiRouter
      { source: '/litellm-vs-openrouter', destination: '/litellm-vs-muirouter', permanent: true },
    ];
  },
};

export default withNextIntl(withMDX(nextConfig));

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

initOpenNextCloudflareForDev({
  configPath: './wrangler.jsonc',
  persist: {
    path: sharedCloudflareStateV3Path,
  },
  remoteBindings: false,
});
