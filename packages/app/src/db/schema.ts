import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// 1. 用户表：以邮箱为核心身份
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // UUID
  email: text('email').unique().notNull(),
  stripeCustomerId: text('stripe_customer_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// 2. 钱包表：存储余额
export const wallets = sqliteTable('wallets', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id),
  balance: real('balance').default(0.0), // 存储单位：USD
  currency: text('currency').default('USD'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// 3. 模型定价表
export const models = sqliteTable('models', {
  id: text('id').primaryKey(), // 网关暴露的模型名，如 "gpt-4o", "gemini-pro"
  provider: text('provider').notNull(), // "openai", "google", "replicate"
  upstreamModelId: text('upstream_model_id'), // 上游真实模型名
  inputPrice: real('input_price'), // 每 1M token 价格
  outputPrice: real('output_price'),
  markupRate: real('markup_rate').default(1.2), // 利润倍率
});

// 6. 使用日志
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

// 7. 消费限额表
export const spendingLimits = sqliteTable('spending_limits', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id),
  monthlyLimit: real('monthly_limit'), // 月度消费上限 USD
  alertThreshold: real('alert_threshold').default(0.8), // 告警阈值百分比（0.8 = 80%）
  isSuspended: integer('is_suspended', { mode: 'boolean' }).default(false),
  lastAlertAt: integer('last_alert_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// 导出类型
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;

export type Model = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;

export type UsageLog = typeof usageLogs.$inferSelect;
export type NewUsageLog = typeof usageLogs.$inferInsert;

export type SpendingLimit = typeof spendingLimits.$inferSelect;
export type NewSpendingLimit = typeof spendingLimits.$inferInsert;
