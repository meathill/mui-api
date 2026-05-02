import { and, desc, eq, gte, lt, lte, sql } from 'drizzle-orm';
import type { Database } from '../db';
import { rechargeLogs, usageLogs, wallets } from '../db';
import { formatBalance, toCents } from '../lib/money';
import { KVService } from './kv-service';

export interface BalanceSnapshot {
  currency: string;
  balance: string;
  balance_cents: number;
  lifetime_topped_up_cents: number;
  lifetime_spent_cents: number;
  updated_at: string;
}

export interface UsageItem {
  id: string;
  model_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost: number;
  cost_cents: number;
  created_at: string;
}

export interface RechargeItem {
  id: string;
  amount: number;
  amount_cents: number;
  source: string;
  source_id: string | null;
  note: string | null;
  balance_after: number | null;
  created_at: string;
}

export interface PageResult<T> {
  items: T[];
  next_cursor: string | null;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function clampLimit(raw: string | undefined): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function encodeCursor(createdAt: Date | number, id: string): string {
  const ts = createdAt instanceof Date ? Math.floor(createdAt.getTime() / 1000) : createdAt;
  // base64url（Web 标准 btoa 不接受 + / =，转换一下）
  return btoa(`${ts}|${id}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeCursor(cursor: string | undefined): { ts: number; id: string } | null {
  if (!cursor) return null;
  try {
    const padded = cursor.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(padded);
    const [tsStr, id] = decoded.split('|');
    const ts = Number(tsStr);
    if (!Number.isFinite(ts) || !id) return null;
    return { ts, id };
  } catch {
    return null;
  }
}

function toIso(value: Date | number | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date(value * 1000).toISOString();
}

/**
 * 余额快照。**balance 真账本在 KV**（auth middleware 在那里扣账），D1 wallets 表只是
 * 早期方案残留的非同步副本。以前 MCP / `/v1/balance` 直接读 D1 副本会拿到 0 + 1970-01-01
 * （副本从没被写入），跟 dashboard 显示对不上。
 *
 * 现行做法：balance 从 KV 读，单位 USD；lifetime_topped_up / spent 仍按 D1 logs aggregate
 * （这些是审计记录，写入双写比较稳）。updated_at fallback 到 wallets.updatedAt 或当前时间。
 *
 * KV 没有 currency 字段，全局假设 USD（与 wallets.currency 默认一致）。
 */
export async function getBalanceSnapshot(
  db: Database,
  userId: string,
  kv?: KVNamespace,
): Promise<BalanceSnapshot> {
  const [wallet, kvData, topupAgg, spendAgg] = await Promise.all([
    db.query.wallets.findFirst({ where: eq(wallets.userId, userId) }),
    kv ? new KVService(kv).getUser(userId) : Promise.resolve({ data: null, metadata: null }),
    db
      .select({ total: sql<number>`COALESCE(SUM(${rechargeLogs.amount}), 0)` })
      .from(rechargeLogs)
      .where(eq(rechargeLogs.userId, userId)),
    db
      .select({ total: sql<number>`COALESCE(SUM(${usageLogs.cost}), 0)` })
      .from(usageLogs)
      .where(eq(usageLogs.userId, userId)),
  ]);

  const currency = wallet?.currency ?? 'USD';
  // KV 优先；KV 没值（极少：还没初始化）才 fallback 到 wallets 副本
  const balance = kvData.data?.balance ?? wallet?.balance ?? 0;
  const updatedAt = kvData.data ? new Date() : (wallet?.updatedAt ?? null);
  const toppedUp = Number(topupAgg[0]?.total ?? 0);
  const spent = Number(spendAgg[0]?.total ?? 0);

  return {
    currency,
    balance: formatBalance(balance, currency),
    balance_cents: toCents(balance, currency),
    lifetime_topped_up_cents: toCents(toppedUp, currency),
    lifetime_spent_cents: toCents(spent, currency),
    updated_at: toIso(updatedAt),
  };
}

export async function listUsage(
  db: Database,
  userId: string,
  opts: {
    limit?: string;
    cursor?: string;
    model?: string;
    from?: string;
    to?: string;
  } = {},
): Promise<PageResult<UsageItem>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  const wallet = await db.query.wallets.findFirst({ where: eq(wallets.userId, userId) });
  const currency = wallet?.currency ?? 'USD';

  const conds = [eq(usageLogs.userId, userId)];
  if (opts.model) conds.push(eq(usageLogs.modelId, opts.model));
  if (opts.from) {
    const ts = Math.floor(new Date(opts.from).getTime() / 1000);
    if (Number.isFinite(ts)) conds.push(gte(usageLogs.createdAt, new Date(ts * 1000)));
  }
  if (opts.to) {
    const ts = Math.floor(new Date(opts.to).getTime() / 1000);
    if (Number.isFinite(ts)) conds.push(lte(usageLogs.createdAt, new Date(ts * 1000)));
  }
  if (cursor) {
    conds.push(lt(usageLogs.createdAt, new Date(cursor.ts * 1000)));
  }

  const rows = await db
    .select()
    .from(usageLogs)
    .where(and(...conds))
    .orderBy(desc(usageLogs.createdAt), desc(usageLogs.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const items: UsageItem[] = slice.map((r) => ({
    id: r.id,
    model_id: r.modelId,
    input_tokens: r.inputTokens,
    output_tokens: r.outputTokens,
    cost: r.cost ?? 0,
    cost_cents: toCents(r.cost ?? 0, currency),
    created_at: toIso(r.createdAt),
  }));

  const nextCursor = hasMore ? encodeCursor(slice[slice.length - 1]?.createdAt!, slice[slice.length - 1]?.id) : null;
  return { items, next_cursor: nextCursor };
}

export async function listRecharges(
  db: Database,
  userId: string,
  opts: { limit?: string; cursor?: string } = {},
): Promise<PageResult<RechargeItem>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  const wallet = await db.query.wallets.findFirst({ where: eq(wallets.userId, userId) });
  const currency = wallet?.currency ?? 'USD';

  const conds = [eq(rechargeLogs.userId, userId)];
  if (cursor) {
    conds.push(lt(rechargeLogs.createdAt, new Date(cursor.ts * 1000)));
  }

  const rows = await db
    .select()
    .from(rechargeLogs)
    .where(and(...conds))
    .orderBy(desc(rechargeLogs.createdAt), desc(rechargeLogs.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const items: RechargeItem[] = slice.map((r) => ({
    id: r.id,
    amount: r.amount,
    amount_cents: toCents(r.amount, currency),
    source: r.source ?? 'admin',
    source_id: r.sourceId,
    note: r.note,
    balance_after: r.balanceAfter ?? null,
    created_at: toIso(r.createdAt),
  }));

  const nextCursor = hasMore ? encodeCursor(slice[slice.length - 1]?.createdAt!, slice[slice.length - 1]?.id) : null;
  return { items, next_cursor: nextCursor };
}
