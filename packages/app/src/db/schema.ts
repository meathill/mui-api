import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// 1. 用户表：以邮箱为核心身份
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // UUID
  email: text("email").unique().notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(unixepoch())`,
  ),
});

// 2. 钱包表：存储余额
export const wallets = sqliteTable("wallets", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  balance: real("balance").default(0.0), // 存储单位：USD
  currency: text("currency").default("USD"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(unixepoch())`,
  ),
});

// 3. API 密钥表
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  keyPrefix: text("key_prefix").notNull(), // 展示用 "sk-gw-..."
  keyHash: text("key_hash").notNull(), // 鉴权用 sha256
  name: text("name"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(unixepoch())`,
  ),
});

// 4. 领卡凭证表 (一次性查看 Key)
export const claimTokens = sqliteTable("claim_tokens", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  tempRawKey: text("temp_raw_key").notNull(), // 暂时存储明文
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  used: integer("used", { mode: "boolean" }).default(false),
});

// 5. 模型定价表
export const models = sqliteTable("models", {
  id: text("id").primaryKey(), // 网关暴露的模型名，如 "gpt-4o", "gemini-pro"
  provider: text("provider").notNull(), // "openai", "google", "replicate"
  upstreamModelId: text("upstream_model_id"), // 上游真实模型名
  inputPrice: real("input_price"), // 每 1M token 价格
  outputPrice: real("output_price"),
  markupRate: real("markup_rate").default(1.2), // 利润倍率
});

// 6. 使用日志
export const usageLogs = sqliteTable("usage_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  apiKeyId: text("api_key_id"),
  modelId: text("model_id"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  cost: real("cost"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(unixepoch())`,
  ),
});

// 导出类型
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type ClaimToken = typeof claimTokens.$inferSelect;
export type NewClaimToken = typeof claimTokens.$inferInsert;

export type Model = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;

export type UsageLog = typeof usageLogs.$inferSelect;
export type NewUsageLog = typeof usageLogs.$inferInsert;
