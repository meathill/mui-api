import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import r2IncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache';
import { withRegionalCache } from '@opennextjs/cloudflare/overrides/incremental-cache/regional-cache';
import doQueue from '@opennextjs/cloudflare/overrides/queue/do-queue';

// 不配 tagCache：公共内容全部走 unstable_cache 的时间式 revalidate，
// 代码里没有任何 revalidateTag/revalidatePath 调用。配上反而给每次缓存查找多一次 D1 往返。
// 将来真要做「后台一键刷新缓存」，需要同时加回 NEXT_TAG_CACHE_D1 绑定并建好 revalidations 表。
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: 'long-lived' }),
  queue: doQueue,
});
