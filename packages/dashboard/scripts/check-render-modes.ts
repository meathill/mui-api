/**
 * 构建后校验渲染模式，防止 Cache Components / PPR 被重新引入。
 *
 * 背景：Next 16.3 的 cacheComponents / partialPrefetching 在 @opennextjs/cloudflare +
 * workerd 上会让所有 request-time 渲染挂死（Worker hung → Cloudflare error 1101 → 500）。
 * 2026-08-09 的一次发布因此让 96 条 blog/pricing 页面和整个登录后 Dashboard 全挂了一天。
 *
 * 这个检查必须放在构建产物上：e2e 跑的是 `next dev`（Node 运行时），
 * 定时器语义和 workerd 不同，根本复现不了该 bug。详见 DEV_NOTE.md。
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(packageRoot, '.next', 'prerender-manifest.json');

type PrerenderRoute = {
  compute?: string;
  experimentalPPR?: boolean;
};

const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
  routes?: Record<string, PrerenderRoute>;
};
const routes = Object.entries(manifest.routes ?? {});

// resuming = PPR 部分预渲染后在运行时 resume；blocking = 运行时整页渲染。
// 两者在 workerd 上都会挂死，只有 static 是安全的。
const unsafe = routes.filter(([, route]) => route.compute && route.compute !== 'static');

if (unsafe.length > 0) {
  const sample = unsafe.slice(0, 10).map(([route, { compute }]) => `  ${route} (compute=${compute})`);
  console.error(
    [
      `构建产物中有 ${unsafe.length} 条预渲染路由的 compute 不是 static，说明 Cache Components / PPR 又被打开了。`,
      '这些路由在 Cloudflare Workers 上会挂死并返回 500。请检查 next.config.ts 是否误开',
      'cacheComponents / partialPrefetching，或页面是否用了 `export const instant`。',
      '',
      ...sample,
      unsafe.length > sample.length ? `  ...另有 ${unsafe.length - sample.length} 条` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  );
  process.exit(1);
}

console.log(`渲染模式检查通过：${routes.length} 条预渲染路由全部为 static。`);
