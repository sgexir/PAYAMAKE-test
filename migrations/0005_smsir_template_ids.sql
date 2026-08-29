PRAGMA foreign_keys = ON;

-- Only update the SMS.ir Pattern/Template IDs.
-- Keep the existing approved message text and variables unchanged.
UPDATE sms_templates
SET template_ref = '925624',
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = (SELECT id FROM sms_providers WHERE provider_key = 'sms_ir')
  AND purpose = 'lead_customer';

UPDATE sms_templates
SET template_ref = '511007',
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = (SELECT id FROM sms_providers WHERE provider_key = 'sms_ir')
  AND purpose = 'lead_admin';
