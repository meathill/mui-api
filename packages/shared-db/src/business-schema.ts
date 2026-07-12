import { sql } from 'drizzle-orm';
import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
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
  // cache 分档（null 表示不启用，回退 inputPrice）
  cachedInputPrice: real('cached_input_price'),
  cacheWritePrice: real('cache_write_price'),
  // 长上下文档位：input + cached + cache_write 之和超过阈值时启用 longContext* 价
  longContextThresholdTokens: integer('long_context_threshold_tokens'),
  longContextInputPrice: real('long_context_input_price'),
  longContextCachedInputPrice: real('long_context_cached_input_price'),
  longContextCacheWritePrice: real('long_context_cache_write_price'),
  longContextOutputPrice: real('long_context_output_price'),
});

export const usageLogs = sqliteTable('usage_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  apiKeyId: text('api_key_id'),
  modelId: text('model_id'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  cachedInputTokens: integer('cached_input_tokens').default(0),
  cacheWriteTokens: integer('cache_write_tokens').default(0),
  tier: text('tier').default('standard'),
  cost: real('cost'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const videoGenerationJobs = sqliteTable('video_generation_jobs', {
  requestId: text('request_id').primaryKey(),
  reservationId: text('reservation_id').notNull().unique(),
  userId: text('user_id').notNull(),
  apiKeyId: text('api_key_id'),
  modelId: text('model_id').notNull(),
  duration: integer('duration').notNull(),
  resolution: text('resolution').notNull(),
  estimatedCost: real('estimated_cost').notNull(),
  markupRate: real('markup_rate').notNull(),
  rateMultiplier: real('rate_multiplier').notNull(),
  status: text('status').notNull().default('pending'),
  actualCost: real('actual_cost'),
  settledCost: real('settled_cost'),
  billedAt: integer('billed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
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
  totalCachedInputTokens: integer('total_cached_input_tokens').default(0),
  totalCacheWriteTokens: integer('total_cache_write_tokens').default(0),
  requestCount: integer('request_count').default(0),
  longContextRequestCount: integer('long_context_request_count').default(0),
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

export const blogPosts = sqliteTable('blog_posts', {
  slug: text('slug').primaryKey(),
  publishedAt: text('published_at').notNull(),
  sourcePublishedAt: text('source_published_at').notNull(),
  readingMinutes: integer('reading_minutes').notNull(),
  status: text('status').notNull().default('draft'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const blogPostTranslations = sqliteTable(
  'blog_post_translations',
  {
    slug: text('slug')
      .notNull()
      .references(() => blogPosts.slug, { onDelete: 'cascade' }),
    locale: text('locale').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    tagsJson: text('tags_json').notNull().default('[]'),
    sourcesJson: text('sources_json').notNull().default('[]'),
  },
  (table) => [primaryKey({ columns: [table.slug, table.locale] })],
);

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;

export type Model = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;

export type UsageLog = typeof usageLogs.$inferSelect;
export type NewUsageLog = typeof usageLogs.$inferInsert;

export type VideoGenerationJob = typeof videoGenerationJobs.$inferSelect;
export type NewVideoGenerationJob = typeof videoGenerationJobs.$inferInsert;

export type RechargeLog = typeof rechargeLogs.$inferSelect;
export type NewRechargeLog = typeof rechargeLogs.$inferInsert;

export type StripeTopupSession = typeof stripeTopupSessions.$inferSelect;
export type NewStripeTopupSession = typeof stripeTopupSessions.$inferInsert;

export type UsageStat = typeof usageStats.$inferSelect;
export type NewUsageStat = typeof usageStats.$inferInsert;

export type SpendingLimit = typeof spendingLimits.$inferSelect;
export type NewSpendingLimit = typeof spendingLimits.$inferInsert;

export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;
export type BlogPostTranslation = typeof blogPostTranslations.$inferSelect;
export type NewBlogPostTranslation = typeof blogPostTranslations.$inferInsert;

/**
 * OAuth 2.0 三件套：clients / codes / tokens。
 *
 * - **oauthClients**：注册过的第三方应用（client_id + secret 哈希 + 允许的 redirect_uri /
 *   scope 白名单）。给 muicv 之类的客户端发 token 前先走这里校验。secret 只存 SHA-256。
 * - **oauthCodes**：authorization_code 流程里的一次性 code，5 分钟过期，单次消费（used=1
 *   再来不接受），跟 client_id + redirect_uri 绑死防转售。
 * - **oauthTokens**：颁发的 access / refresh token，存 SHA-256 哈希。`kind` 区分两种；
 *   `pairId` 把同一对 access+refresh 关联起来，refresh 时整对替换。
 */
export const oauthClients = sqliteTable('oauth_clients', {
  clientId: text('client_id').primaryKey(),
  clientSecretHash: text('client_secret_hash').notNull(),
  name: text('name').notNull(),
  ownerEmail: text('owner_email'),
  /** JSON array string，例如 `["https://muicv.com/api/muirouter/oauth/callback"]`。 */
  allowedRedirectUris: text('allowed_redirect_uris').notNull(),
  /** 逗号分隔，例如 `"balance,llm"`。 */
  allowedScopes: text('allowed_scopes').notNull().default('balance,llm'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const oauthCodes = sqliteTable('oauth_codes', {
  codeHash: text('code_hash').primaryKey(),
  clientId: text('client_id')
    .notNull()
    .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  redirectUri: text('redirect_uri').notNull(),
  scope: text('scope').notNull(),
  /** code 过期 unix 时间戳（秒）。 */
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  /** 单次消费——被换过 token 就置 1，第二次再来 400 invalid_grant。 */
  used: integer('used', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const oauthTokens = sqliteTable('oauth_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  /** `'access'` 或 `'refresh'`。 */
  kind: text('kind').notNull(),
  /** access + refresh 同一对共享一个 pairId，refresh 时把同 pairId 的两条整对替换/删除。 */
  pairId: text('pair_id').notNull(),
  clientId: text('client_id')
    .notNull()
    .references(() => oauthClients.clientId, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  scope: text('scope').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export type OauthClient = typeof oauthClients.$inferSelect;
export type NewOauthClient = typeof oauthClients.$inferInsert;
export type OauthCode = typeof oauthCodes.$inferSelect;
export type NewOauthCode = typeof oauthCodes.$inferInsert;
export type OauthToken = typeof oauthTokens.$inferSelect;
export type NewOauthToken = typeof oauthTokens.$inferInsert;
