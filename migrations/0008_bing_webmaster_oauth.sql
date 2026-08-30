-- PAYAMAKE D1 Migration 0008: Bing Webmaster OAuth
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS bing_webmaster_oauth_states (
  state_hash TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bing_webmaster_connections (
  admin_id INTEGER PRIMARY KEY,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  access_expires_at TEXT,
  scope TEXT,
  connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bing_oauth_states_expires_at
  ON bing_webmaster_oauth_states(expires_at);
