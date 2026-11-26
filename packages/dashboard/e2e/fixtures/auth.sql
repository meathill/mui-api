INSERT OR IGNORE INTO user (
  id,
  name,
  email,
  email_verified,
  created_at,
  updated_at,
  accepted_terms_at,
  accepted_terms_version,
  accepted_privacy_version
) VALUES (
  'e2e-legacy-alias-user',
  'Legacy Alias User',
  'legacy+tag@example.com',
  1,
  unixepoch(),
  unixepoch(),
  unixepoch() * 1000,
  '2026-11-25',
  '2026-11-25'
);
