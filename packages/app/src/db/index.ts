import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

/**
 * D1DatabaseSession 在 prepare/batch 上与 D1Database 结构兼容（drizzle 的 D1 session 实现只用这两个方法），
 * 但 drizzle-orm 当前版本的类型未收录 D1DatabaseSession，故此处 cast。
 */
export function createDb(d1: D1Database | D1DatabaseSession) {
  return drizzle(d1 as D1Database, { schema });
}

export type Database = ReturnType<typeof createDb>;
export * from './schema';
