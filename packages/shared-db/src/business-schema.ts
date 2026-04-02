import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { user } from './auth-schema';

export const wallets = sqliteTable('wallets', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id),
  balance: real('balance').default(0.0),
  currency: text('currency').default('USD'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
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

export const rechargeLogs = sqliteTable('recharge_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  operatorId: text('operator_id'),
  amount: real('amount').notNull(),
  balanceAfter: real('balance_after'),
  source: text('source').default('admin'),
  sourceId: text('source_id'),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const stripeTopupSessions = sqliteTable('stripe_topup_sessions', {
  checkoutSessionId: text('checkout_session_id').primaryKey(),
  userId: text('user_id').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('USD'),
  status: text('status').notNull().default('created'),
  paymentStatus: text('payment_status'),
  stripeCustomerId: text('stripe_customer_id'),
  paymentIntentId: text('payment_intent_id'),
  balanceAfter: real('balance_after'),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

export const usageStats = sqliteTable('usage_stats', {
  id: text('id').primaryKey(),
  granularity: text('granularity').notNull(),
  periodStart: integer('period_start', { mode: 'timestamp' }).notNull(),
  periodEnd: integer('period_end', { mode: 'timestamp' }).notNull(),
  userId: text('user_id'),
  modelId: text('model_id'),
  totalCost: real('total_cost').default(0),
  totalInputTokens: integer('total_input_tokens').default(0),
  totalOutputTokens: integer('total_output_tokens').default(0),
  requestCount: integer('request_count').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
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

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;

export type Model = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;

export type UsageLog = typeof usageLogs.$inferSelect;
export type NewUsageLog = typeof usageLogs.$inferInsert;

export type RechargeLog = typeof rechargeLogs.$inferSelect;
export type NewRechargeLog = typeof rechargeLogs.$inferInsert;

export type StripeTopupSession = typeof stripeTopupSessions.$inferSelect;
export type NewStripeTopupSession = typeof stripeTopupSessions.$inferInsert;

export type UsageStat = typeof usageStats.$inferSelect;
export type NewUsageStat = typeof usageStats.$inferInsert;

export type SpendingLimit = typeof spendingLimits.$inferSelect;
export type NewSpendingLimit = typeof spendingLimits.$inferInsert;
