CREATE TABLE IF NOT EXISTS sms_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
    sender_number TEXT,
    settings_json TEXT,
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
    name TEXT NOT NULL,
    template_id TEXT,
    message_template TEXT,
    variables_json TEXT,
    settings_json TEXT,
    is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
    is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES sms_providers(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sms_templates_provider_purpose_default
    ON sms_templates(provider_id, purpose)
    WHERE is_default = 1;

CREATE INDEX IF NOT EXISTS idx_sms_templates_provider_purpose
    ON sms_templates(provider_id, purpose);

CREATE TABLE IF NOT EXISTS sms_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    lead_id INTEGER,
    purpose TEXT NOT NULL,
    recipient TEXT NOT NULL,
    sender TEXT,
    template_id TEXT,
    message TEXT,
    send_status TEXT NOT NULL DEFAULT 'pending' CHECK (send_status IN ('pending', 'sent', 'failed')),
    delivery_status TEXT NOT NULL DEFAULT 'unknown' CHECK (delivery_status IN ('unknown', 'pending', 'delivered', 'failed', 'expired')),
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

CREATE INDEX IF NOT EXISTS idx_sms_logs_provider_created_at
    ON sms_logs(provider_id, created_at);

CREATE INDEX IF NOT EXISTS idx_sms_logs_lead_created_at
    ON sms_logs(lead_id, created_at);

CREATE INDEX IF NOT EXISTS idx_sms_logs_provider_message_id
    ON sms_logs(provider_id, provider_message_id);

CREATE INDEX IF NOT EXISTS idx_sms_logs_delivery_status
    ON sms_logs(delivery_status, created_at);

INSERT OR IGNORE INTO sms_providers (key, name, is_enabled, is_default)
VALUES ('niazpardaz', 'Niazpardaz', 1, 1);

INSERT OR IGNORE INTO sms_providers (key, name, is_enabled, is_default)
VALUES ('sms_ir', 'SMS.ir', 1, 0);

INSERT OR IGNORE INTO sms_templates (provider_id, purpose, name, template_id, message_template, variables_json, is_enabled, is_default)
SELECT id, 'lead_customer', 'Customer Lead SMS', NULL, NULL, '["FULLNAME"]', 1, 1
FROM sms_providers WHERE key = 'niazpardaz';

INSERT OR IGNORE INTO sms_templates (provider_id, purpose, name, template_id, message_template, variables_json, is_enabled, is_default)
SELECT id, 'lead_admin', 'Admin Lead SMS', NULL, NULL, '["FULLNAME","PHONE","BRAND","TYPE","DESCRIPTION"]', 1, 1
FROM sms_providers WHERE key = 'niazpardaz';

INSERT OR IGNORE INTO sms_templates (provider_id, purpose, name, template_id, message_template, variables_json, is_enabled, is_default)
SELECT id, 'lead_customer', 'Customer Lead SMS', NULL, NULL, '["FULLNAME"]', 1, 1
FROM sms_providers WHERE key = 'sms_ir';

INSERT OR IGNORE INTO sms_templates (provider_id, purpose, name, template_id, message_template, variables_json, is_enabled, is_default)
SELECT id, 'lead_admin', 'Admin Lead SMS', NULL, NULL, '["FULLNAME","PHONE","BRAND","TYPE","DESCRIPTION"]', 1, 1
FROM sms_providers WHERE key = 'sms_ir';
