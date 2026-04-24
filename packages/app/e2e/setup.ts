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
    'CREATE TABLE IF NOT EXISTS models (id TEXT PRIMARY KEY NOT NULL, provider TEXT NOT NULL, upstream_model_id TEXT, input_price REAL, output_price REAL, markup_rate REAL DEFAULT 1.2)',
  ),
  db.prepare(
    'CREATE TABLE IF NOT EXISTS usage_logs (id TEXT PRIMARY KEY NOT NULL, user_id TEXT, api_key_id TEXT, model_id TEXT, input_tokens INTEGER, output_tokens INTEGER, cost REAL, created_at INTEGER DEFAULT (unixepoch()))',
  ),
  db.prepare(
    "CREATE TABLE IF NOT EXISTS wallets (user_id TEXT PRIMARY KEY NOT NULL, balance REAL DEFAULT 0, currency TEXT DEFAULT 'USD', updated_at INTEGER DEFAULT (unixepoch()), FOREIGN KEY (user_id) REFERENCES user(id))",
  ),
  db.prepare(
    'CREATE TABLE IF NOT EXISTS spending_limits (user_id TEXT PRIMARY KEY NOT NULL, monthly_limit REAL, alert_threshold REAL DEFAULT 0.8, is_suspended INTEGER DEFAULT false, last_alert_at INTEGER, updated_at INTEGER DEFAULT (unixepoch()), FOREIGN KEY (user_id) REFERENCES user(id))',
  ),

  db.prepare(
    "CREATE TABLE IF NOT EXISTS recharge_logs (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, operator_id TEXT, amount REAL NOT NULL, balance_after REAL, source TEXT DEFAULT 'admin', source_id TEXT, note TEXT, created_at INTEGER DEFAULT (unixepoch()))",
  ),
  db.prepare(
    'CREATE TABLE IF NOT EXISTS usage_stats (id TEXT PRIMARY KEY NOT NULL, granularity TEXT NOT NULL, period_start INTEGER NOT NULL, period_end INTEGER NOT NULL, user_id TEXT, model_id TEXT, total_cost REAL DEFAULT 0, total_input_tokens INTEGER DEFAULT 0, total_output_tokens INTEGER DEFAULT 0, request_count INTEGER DEFAULT 0, created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))',
  ),
  db.prepare(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_stats_unique ON usage_stats (granularity, period_start, user_id, model_id)',
  ),
  db.prepare('CREATE INDEX IF NOT EXISTS idx_usage_stats_query ON usage_stats (granularity, period_start, period_end)'),

  // 种子数据：测试用户
  db.prepare(
    "INSERT OR IGNORE INTO user (id, name, email, email_verified, image, created_at, updated_at) VALUES ('test-user-1', 'test@example.com', 'test@example.com', 1, NULL, unixepoch(), unixepoch())",
  ),
  db.prepare("INSERT OR IGNORE INTO wallets (user_id, balance) VALUES ('test-user-1', 10.0)"),
  db.prepare(
    "INSERT OR IGNORE INTO user (id, name, email, email_verified, image, created_at, updated_at) VALUES ('test-user-broke', 'broke@example.com', 'broke@example.com', 1, NULL, unixepoch(), unixepoch())",
  ),
  db.prepare("INSERT OR IGNORE INTO wallets (user_id, balance) VALUES ('test-user-broke', 0.0)"),

  // 种子数据：测试模型
  db.prepare(
    "INSERT OR IGNORE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES ('gpt-4o', 'openai', 'gpt-4o', 0.0025, 0.01, 1.2)",
  ),
  db.prepare(
    "INSERT OR IGNORE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES ('gpt-image-2', 'openai', 'gpt-image-2', 8, 30, 1.2)",
  ),
  db.prepare(
    "INSERT OR IGNORE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate) VALUES ('claude-sonnet-4-20250514', 'anthropic', 'claude-sonnet-4-20250514', 0.003, 0.015, 1.2)",
  ),
]);
