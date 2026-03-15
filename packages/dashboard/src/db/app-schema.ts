/**
 * App 业务表定义
 * 与 packages/app 共享同一个 D1 数据库
 * 用户体系统一使用 better-auth 的 user 表，此处只定义业务表
 */
import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './schema';

export const wallets = sqliteTable('wallets', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id),
  balance: real('balance').default(0.0),
  currency: text('currency').default('USD'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id),
  keyPrefix: text('key_prefix').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  name: text('name'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const claimTokens = sqliteTable('claim_tokens', {
  token: text('token').primaryKey(),
  userId: text('user_id').notNull(),
  tempRawKey: text('temp_raw_key').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  used: integer('used', { mode: 'boolean' }).default(false),
});

export const models = sqliteTable('models', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  upstreamModelId: text('upstream_model_id'),
  inputPrice: real('input_price'),
  outputPrice: real('output_price'),
  markupRate: real('markup_rate').default(1.2),
});

export const usageLogs = sqliteTable('usage_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  apiKeyId: text('api_key_id'),
  modelId: text('model_id'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  cost: real('cost'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const spendingLimits = sqliteTable('spending_limits', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id),
  monthlyLimit: real('monthly_limit'),
  alertThreshold: real('alert_threshold').default(0.8),
  isSuspended: integer('is_suspended', { mode: 'boolean' }).default(false),
  lastAlertAt: integer('last_alert_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
