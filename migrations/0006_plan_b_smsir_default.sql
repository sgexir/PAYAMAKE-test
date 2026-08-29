-- PAYAMAKE Migration 0006: Plan B SMS configuration
-- Keep both providers available, but use SMS.ir as the active default while
-- Niazpardaz connectivity is being resolved. Customer SMS is intentionally
-- disabled; admin notification remains enabled.

UPDATE sms_providers
SET is_default = 0,
    updated_at = CURRENT_TIMESTAMP;

UPDATE sms_providers
SET is_default = 1,
    is_enabled = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_key = 'sms_ir';

UPDATE sms_templates
SET is_enabled = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = (SELECT id FROM sms_providers WHERE provider_key = 'sms_ir')
  AND purpose = 'lead_customer';

UPDATE sms_templates
SET is_enabled = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = (SELECT id FROM sms_providers WHERE provider_key = 'sms_ir')
  AND purpose = 'lead_admin';
