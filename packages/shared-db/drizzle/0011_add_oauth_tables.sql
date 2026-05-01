-- OAuth 2.0 服务端三件套：clients / codes / tokens。
-- 协议规范见 muirouter-spec.md「§ OAuth 2.0」段落与 muicv 仓库
-- packages/shared/src/muirouter-oauth.ts。
--
-- clients: 第三方应用注册表。client_secret 只存 SHA-256 哈希，原文颁发时显示一次。
--          allowed_redirect_uris 是 JSON 数组字符串，token / authorize 时严格校验。
-- codes:   authorization_code 临时码，5 min 过期，单次消费（used=1 后再来 invalid_grant）。
-- tokens:  颁发的 access / refresh，token_hash = SHA-256。同一对 access+refresh 共享 pair_id，
--          refresh 时按 pair_id 整对替换；revoke 时按 pair_id 整对删除。

CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_secret_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  owner_email TEXT,
  allowed_redirect_uris TEXT NOT NULL,
  allowed_scopes TEXT NOT NULL DEFAULT 'balance,llm',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS oauth_codes (
  code_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES `user`(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_oauth_codes_user ON oauth_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_codes_expires ON oauth_codes(expires_at);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  pair_id TEXT NOT NULL,
  client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES `user`(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_pair ON oauth_tokens(pair_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON oauth_tokens(expires_at);
