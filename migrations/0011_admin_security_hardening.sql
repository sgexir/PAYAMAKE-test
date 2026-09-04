-- PAYAMAKE D1 Migration 0011: Admin Security Hardening
-- Runtime security-auth.js also ensures these objects exist for staging deployments.
PRAGMA foreign_keys = ON;

ALTER TABLE admins ADD COLUMN username TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_admins_username
  ON admins(username) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS security_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  action TEXT NOT NULL,
  target_admin_id INTEGER,
  ip_address TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(admin_id) REFERENCES admins(id) ON DELETE SET NULL,
  FOREIGN KEY(target_admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_security_audit_created_at ON security_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_target ON security_audit_log(target_admin_id);

CREATE TABLE IF NOT EXISTS ip_blocklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT,
  blocked_by INTEGER,
  blocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unblocked_at TEXT,
  FOREIGN KEY(blocked_by) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ip_blocklist_active ON ip_blocklist(ip_address, unblocked_at);
