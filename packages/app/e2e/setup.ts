import { env } from 'cloudflare:test';

/**
 * E2E 测试 setup：初始化 D1 schema 和种子数据
 * 注意：setup 运行在 workerd 内部
 * 使用 db.batch() 批量执行 prepared statements
 */

const db = env.DB;

await db.batch([
  // 创建表结构
  db.prepare(
    'CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, email_verified INTEGER NOT NULL, image TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
  ),
  db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS user_email_unique ON user (email)'),
  db.prepare(
    'CREATE TABLE IF NOT EXISTS models (id TEXT PRIMARY KEY NOT NULL, provider TEXT NOT NULL, upstream_model_id TEXT, input_price REAL, output_price REAL, markup_rate REAL DEFAULT 1.2, cached_input_price REAL, cache_write_price REAL, long_context_threshold_tokens INTEGER, long_context_input_price REAL, long_context_cached_input_price REAL, long_context_cache_write_price REAL, long_context_output_price REAL)',
  ),
  db.prepare(
    "CREATE TABLE IF NOT EXISTS usage_logs (id TEXT PRIMARY KEY NOT NULL, user_id TEXT, api_key_id TEXT, model_id TEXT, input_tokens INTEGER, output_tokens INTEGER, cached_input_tokens INTEGER DEFAULT 0, cache_write_tokens INTEGER DEFAULT 0, tier TEXT DEFAULT 'standard', cost REAL, created_at INTEGER DEFAULT (unixepoch()))",
  ),
  db.prepare(
    "CREATE TABLE IF NOT EXISTS video_generation_jobs (request_id TEXT PRIMARY KEY NOT NULL, reservation_id TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL, api_key_id TEXT, model_id TEXT NOT NULL, duration INTEGER NOT NULL, resolution TEXT NOT NULL, estimated_cost REAL NOT NULL, markup_rate REAL NOT NULL, rate_multiplier REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pending', actual_cost REAL, settled_cost REAL, billed_at INTEGER, created_at INTEGER NOT NULL DEFAULT (unixepoch()), updated_at INTEGER NOT NULL DEFAULT (unixepoch()))",
  ),
  db.prepare(
    'CREATE TABLE IF NOT EXISTS spending_limits (user_id TEXT PRIMARY KEY NOT NULL, monthly_limit REAL, alert_threshold REAL DEFAULT 0.8, is_suspended INTEGER DEFAULT false, last_alert_at INTEGER, updated_at INTEGER DEFAULT (unixepoch()), FOREIGN KEY (user_id) REFERENCES user(id))',
  ),

  db.prepare(
    "CREATE TABLE IF NOT EXISTS recharge_logs (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, operator_id TEXT, amount REAL NOT NULL, balance_after REAL, source TEXT DEFAULT 'admin', source_id TEXT, note TEXT, created_at INTEGER DEFAULT (unixepoch()))",
  ),
  db.prepare(
    "CREATE TABLE IF NOT EXISTS stripe_topup_sessions (checkout_session_id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'USD', status TEXT NOT NULL DEFAULT 'created', payment_status TEXT, stripe_customer_id TEXT, payment_intent_id TEXT, balance_after REAL, last_error TEXT, created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()), completed_at INTEGER)",
  ),
  db.prepare(
    'CREATE TABLE IF NOT EXISTS usage_stats (id TEXT PRIMARY KEY NOT NULL, granularity TEXT NOT NULL, period_start INTEGER NOT NULL, period_end INTEGER NOT NULL, user_id TEXT, model_id TEXT, total_cost REAL DEFAULT 0, total_input_tokens INTEGER DEFAULT 0, total_output_tokens INTEGER DEFAULT 0, total_cached_input_tokens INTEGER DEFAULT 0, total_cache_write_tokens INTEGER DEFAULT 0, request_count INTEGER DEFAULT 0, long_context_request_count INTEGER DEFAULT 0, created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))',
  ),
  db.prepare(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_stats_unique ON usage_stats (granularity, period_start, user_id, model_id)',
  ),
  db.prepare('CREATE INDEX IF NOT EXISTS idx_usage_stats_query ON usage_stats (granularity, period_start, period_end)'),

  // OAuth 2.0 三件套（与 shared-db business-schema.ts 对齐；timestamp 列存 unix 秒）
  db.prepare(
    "CREATE TABLE IF NOT EXISTS oauth_clients (client_id TEXT PRIMARY KEY NOT NULL, client_secret_hash TEXT NOT NULL, name TEXT NOT NULL, owner_email TEXT, allowed_redirect_uris TEXT NOT NULL, allowed_scopes TEXT NOT NULL DEFAULT 'balance,llm', is_active INTEGER NOT NULL DEFAULT 1, created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))",
  ),
  db.prepare(
    'CREATE TABLE IF NOT EXISTS oauth_codes (code_hash TEXT PRIMARY KEY NOT NULL, client_id TEXT NOT NULL, user_id TEXT NOT NULL, redirect_uri TEXT NOT NULL, scope TEXT NOT NULL, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, created_at INTEGER DEFAULT (unixepoch()))',
  ),
  db.prepare(
    'CREATE TABLE IF NOT EXISTS oauth_tokens (token_hash TEXT PRIMARY KEY NOT NULL, kind TEXT NOT NULL, pair_id TEXT NOT NULL, client_id TEXT NOT NULL, user_id TEXT NOT NULL, scope TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER DEFAULT (unixepoch()))',
  ),

  // 种子数据：测试用户
  db.prepare(
    "INSERT OR IGNORE INTO user (id, name, email, email_verified, image, created_at, updated_at) VALUES ('test-user-1', 'test@example.com', 'test@example.com', 1, NULL, unixepoch(), unixepoch())",
  ),
  db.prepare(
    "INSERT OR IGNORE INTO user (id, name, email, email_verified, image, created_at, updated_at) VALUES ('test-user-broke', 'broke@example.com', 'broke@example.com', 1, NULL, unixepoch(), unixepoch())",
  ),

  // 种子数据：测试模型
  db.prepare(
    "INSERT OR IGNORE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES ('gpt-4o', 'openai', 'gpt-4o', 0.0025, 0.01, 1.2)",
  ),
  db.prepare(
    "INSERT OR IGNORE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES ('gpt-image-2', 'openai', 'gpt-image-2', 8, 30, 1.2)",
  ),
  // 带 cached_input_price 的种子行：用于验证 Responses API cached token 拆分计费（区别于全价误算）
  db.prepare(
    "INSERT OR IGNORE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate, cached_input_price) VALUES ('gpt-4o-cached-test', 'openai', 'gpt-4o-cached-test', 2.5, 10, 1.2, 1.25)",
  ),
  db.prepare(
    "INSERT OR IGNORE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES ('claude-sonnet-4-20250514', 'anthropic', 'claude-sonnet-4-20250514', 0.003, 0.015, 1.2)",
  ),
  db.prepare(
    "INSERT OR IGNORE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES ('mimo-v2.5-pro', 'xiaomi-mimo', 'mimo-v2.5-pro', 1, 3, 1.2)",
  ),
  db.prepare(
    "INSERT OR IGNORE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate, cached_input_price) VALUES ('kimi-k3', 'moonshot', 'kimi-k3', 3, 15, 1.2, 0.3)",
  ),
  db.prepare(
    "INSERT OR IGNORE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES ('mimo-v2.5-tts', 'xiaomi-mimo', 'mimo-v2.5-tts', 0, 0, 1.2)",
  ),
  db.prepare(
    "INSERT OR IGNORE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES ('grok-4.3', 'grok', 'grok-4.3', 1.25, 2.5, 1.2)",
  ),
  db.prepare(
    "INSERT OR IGNORE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES ('gemini-2.5-flash', 'google-ai-studio', 'gemini-2.5-flash', 0.3, 2.5, 1.2)",
  ),
  db.prepare(
    "INSERT OR IGNORE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES ('grok-imagine-image', 'grok', 'grok-imagine-image', 0, 1, 1.05)",
  ),
  db.prepare(
    "INSERT OR IGNORE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES ('grok-imagine-image-quality', 'grok', 'grok-imagine-image-quality', 0, 1, 1.05)",
  ),
  db.prepare(
    "INSERT OR IGNORE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES ('grok-imagine-video', 'grok', 'grok-imagine-video', 0, 1, 1.05)",
  ),
  db.prepare(
    "INSERT OR IGNORE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES ('grok-imagine-video-1.5', 'grok', 'grok-imagine-video-1.5', 0, 1, 1.05)",
  ),
]);
