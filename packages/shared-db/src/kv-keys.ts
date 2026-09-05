/**
 * KV key 前缀与保留键。
 *
 * app（kv-service.ts）与 dashboard（lib/kv.ts）双端共用同一条 KV 数据，
 * key 格式不一致会静默破坏跨 Worker 数据共享，因此集中定义在这里。
 * 修改任何 key 都需要两端同时部署。
 */

export const USER_KEY_PREFIX = 'user:';
export const APIKEY_PREFIX = 'apikey:';
export const GLOBAL_CONFIG_KEY = 'config:global';
export const GLOBAL_SPENDING_PREFIX = 'stats:';
export const USER_SPENDING_PREFIX = 'spending:user:';
export const MODELS_CATALOG_KEY = 'models:catalog';
