-- PAYAMAKE D1 Migration 0006: Lead management
PRAGMA foreign_keys = ON;

ALTER TABLE leads ADD COLUMN lead_status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE leads ADD COLUMN admin_notes TEXT;
ALTER TABLE leads ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_leads_lead_status ON leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
