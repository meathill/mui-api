import { drizzle } from 'drizzle-orm/d1';
import { withD1Retry } from '@muirouter/shared-db/d1-retry';
import * as schema from './schema';

/**
 * D1DatabaseSession 在 prepare/batch 上与 D1Database 结构兼容（drizzle 的 D1 session 实现只用这两个方法），
 * 但 drizzle-orm 当前版本的类型未收录 D1DatabaseSession，故此处 cast。
 *
 * withD1Retry 包一层：D1 Sessions API（env.DB.withSession，dashboard 侧同一个 D1 库上确认过）
 * 会偶发 `D1_ERROR: Network connection lost.` 这类瞬时网络错误，和查询负载无关，见
 * DEV_NOTE.md「D1 Sessions API 网络瞬时错误」。这里同样会用到 session（d1SessionMiddleware），
 * 计费/用量日志写入路径同样暴露在这个失败模式下。
 */
export function createDb(d1: D1Database | D1DatabaseSession) {
  return drizzle(withD1Retry(d1) as unknown as D1Database, { schema });
}

export type Database = ReturnType<typeof createDb>;
export * from './schema';
