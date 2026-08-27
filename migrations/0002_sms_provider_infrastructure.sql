PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sms_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sender_number TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0,1)),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sms_providers_default
  ON sms_providers(is_default)
  WHERE is_default = 1;

CREATE TABLE IF NOT EXISTS sms_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  purpose TEXT NOT NULL,
  template_ref TEXT,
  name TEXT NOT NULL,
  message_text TEXT,
  variables_json TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0,1)),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES sms_providers(id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE(provider_id, purpose, name)
);

CREATE INDEX IF NOT EXISTS idx_sms_templates_provider_purpose
  ON sms_templates(provider_id, purpose, is_enabled);

CREATE TABLE IF NOT EXISTS sms_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  lead_id INTEGER,
  purpose TEXT NOT NULL,
  recipient TEXT NOT NULL,
  sender TEXT,
  template_id TEXT,
  message TEXT,
  send_status TEXT NOT NULL DEFAULT 'pending' CHECK (send_status IN ('pending','sent','failed')),
  delivery_status TEXT NOT NULL DEFAULT 'unknown' CHECK (delivery_status IN ('unknown','pending','delivered','failed','expired')),
  provider_message_id TEXT,
  provider_code TEXT,
  provider_status TEXT,
  provider_response TEXT,
  error_message TEXT,
  sent_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES sms_providers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_lead_id ON sms_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_provider_id ON sms_logs(provider_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON sms_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sms_logs_delivery ON sms_logs(send_status, delivery_status);
CREATE INDEX IF NOT EXISTS idx_sms_logs_provider_message_id ON sms_logs(provider_id, provider_message_id);

INSERT OR IGNORE INTO sms_providers (provider_key, name, is_enabled, is_default)
VALUES ('niazpardaz', 'Niazpardaz', 1, 1);

INSERT OR IGNORE INTO sms_providers (provider_key, name, is_enabled, is_default)
VALUES ('sms_ir', 'SMS.ir', 1, 0);

INSERT OR IGNORE INTO sms_templates (provider_id, purpose, template_ref, name, message_text, is_default)
SELECT id, 'lead_customer', NULL, 'default', NULL, 1
FROM sms_providers WHERE provider_key = 'niazpardaz';

INSERT OR IGNORE INTO sms_templates (provider_id, purpose, template_ref, name, message_text, is_default)
SELECT id, 'lead_admin', NULL, 'default', NULL, 1
FROM sms_providers WHERE provider_key = 'niazpardaz';

INSERT OR IGNORE INTO sms_templates (provider_id, purpose, template_ref, name, message_text, is_default)
SELECT id, 'lead_customer', NULL, 'default', NULL, 1
FROM sms_providers WHERE provider_key = 'sms_ir';

INSERT OR IGNORE INTO sms_templates (provider_id, purpose, template_ref, name, message_text, is_default)
SELECT id, 'lead_admin', NULL, 'default', NULL, 1
FROM sms_providers WHERE provider_key = 'sms_ir';
