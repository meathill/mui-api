-- 增量结构：旧日志的实扣金额和计费模式未知，保留 NULL。
CREATE TABLE integration_projects (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, repository TEXT NOT NULL, name TEXT NOT NULL,
  billing_mode TEXT NOT NULL DEFAULT 'wallet' CHECK (billing_mode IN ('wallet', 'meter_only')),
  defaults_json TEXT NOT NULL DEFAULT '{}', is_active INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1, integration_version TEXT NOT NULL DEFAULT '1.0.0'
);
CREATE UNIQUE INDEX integration_projects_owner_repository ON integration_projects(owner_id, repository);
CREATE TABLE provider_connections (
  id TEXT PRIMARY KEY, protocol TEXT NOT NULL, base_url TEXT, credential_ref TEXT,
  pricing_source TEXT NOT NULL DEFAULT 'catalog_estimate', enabled INTEGER NOT NULL DEFAULT 1,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE model_connections (
  model_id TEXT PRIMARY KEY, connection_id TEXT NOT NULL REFERENCES provider_connections(id),
  upstream_model_id TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE configuration_changes (
  id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL,
  target TEXT NOT NULL, revision INTEGER NOT NULL, before_json TEXT, after_json TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX configuration_changes_actor_request ON configuration_changes(actor_id, idempotency_key);
CREATE UNIQUE INDEX configuration_changes_target_revision ON configuration_changes(target, revision);
CREATE TABLE control_documents (target TEXT PRIMARY KEY, version INTEGER NOT NULL, data_json TEXT NOT NULL);
CREATE TABLE audio_model_rates (model_id TEXT PRIMARY KEY, unit TEXT NOT NULL, price_per_unit REAL NOT NULL);
ALTER TABLE usage_logs ADD COLUMN project_id TEXT;
ALTER TABLE usage_logs ADD COLUMN charged_cost REAL;
ALTER TABLE usage_logs ADD COLUMN billing_mode TEXT;
ALTER TABLE usage_logs ADD COLUMN pricing_source TEXT;
ALTER TABLE usage_logs ADD COLUMN usage_status TEXT;
ALTER TABLE usage_logs ADD COLUMN upstream_model_id TEXT;
ALTER TABLE usage_logs ADD COLUMN connection_id TEXT;
CREATE INDEX usage_logs_project_created ON usage_logs(project_id, created_at);
ALTER TABLE video_generation_jobs ADD COLUMN project_id TEXT;
ALTER TABLE video_generation_jobs ADD COLUMN billing_mode TEXT NOT NULL DEFAULT 'wallet';
ALTER TABLE oauth_clients ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'client_secret_post';
ALTER TABLE oauth_codes ADD COLUMN code_challenge TEXT;
INSERT INTO oauth_clients (client_id, client_secret_hash, auth_method, name, allowed_redirect_uris, allowed_scopes)
VALUES ('muirouter-cli', '', 'none', 'MuiRouter CLI', '["http://127.0.0.1:18764/callback"]', 'balance,llm,projects:read,projects:write,keys:write,configuration:write');
-- OpenCode Go 为可选连接；启用前由配置预检验证已安装的上游凭证。
INSERT INTO provider_connections (id, protocol, base_url, credential_ref, pricing_source)
VALUES ('opencode-go', 'openai', 'https://opencode.ai/zen/go/v1', 'OPENCODE_GO_API_KEY', 'subscription_estimate');
INSERT INTO model_connections (model_id, connection_id, upstream_model_id)
VALUES ('deepseek-v4-flash', 'opencode-go', 'deepseek-v4-flash');
INSERT OR IGNORE INTO models (id, provider, upstream_model_id, input_price, output_price, markup_rate)
VALUES ('whisper-large-v3-turbo', 'workers-ai', '@cf/openai/whisper-large-v3-turbo', NULL, NULL, 1),
       ('mimo-v2.5-asr', 'xiaomi-mimo', 'mimo-v2.5-asr', NULL, NULL, 1);
