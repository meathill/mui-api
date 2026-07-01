import type { Context, Next } from 'hono';
import { createDb } from '../db';
import type { CloudflareBindings } from '../types';

/**
 * D1 Read Replication 接入：每请求创建一个 D1 Session，写入 Hono context 供后续
 * 全部 DB 访问复用（保证同一请求内的读写顺序一致）。用 'first-unconstrained'
 * 且不做跨请求 bookmark 回传——理由见 DEV_NOTE.md「D1 Sessions 一致性策略」。
 */
export async function d1SessionMiddleware(c: Context<{ Bindings: CloudflareBindings }>, next: Next) {
  const session = c.env.DB.withSession('first-unconstrained');
  c.set('db', createDb(session));
  await next();
}
