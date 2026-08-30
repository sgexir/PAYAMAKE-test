-- PAYAMAKE D1 Migration 0007: Lead activity history
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS lead_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  admin_id INTEGER,
  activity_type TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  note TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_activity_lead_created
  ON lead_activity(lead_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_lead_activity_admin
  ON lead_activity(admin_id, created_at DESC);

INSERT INTO lead_activity (lead_id, activity_type, new_status, created_at)
SELECT id, 'lead_created', lead_status, created_at
FROM leads
WHERE NOT EXISTS (
  SELECT 1 FROM lead_activity a
  WHERE a.lead_id = leads.id AND a.activity_type = 'lead_created'
);
