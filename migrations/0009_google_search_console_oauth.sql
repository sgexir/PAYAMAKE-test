-- PAYAMAKE D1 Migration 0009: Google Search Console OAuth
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS google_search_console_oauth_states (
  state_hash TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS google_search_console_connections (
  admin_id INTEGER PRIMARY KEY,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  access_expires_at TEXT,
  site_url TEXT NOT NULL DEFAULT 'https://payamake.ir/',
  scope TEXT,
  connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_google_search_console_oauth_states_expires_at
  ON google_search_console_oauth_states(expires_at);
