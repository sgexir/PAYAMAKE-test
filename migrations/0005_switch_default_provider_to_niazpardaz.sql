PRAGMA foreign_keys = ON;

-- Move runtime SMS routing to Niazpardaz. The admin-selected D1 default
-- provider is authoritative; environment defaults are only a fallback when
-- no enabled provider is marked as default.
UPDATE sms_providers
SET is_default = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_key <> 'niazpardaz';

UPDATE sms_providers
SET is_default = 1,
    is_enabled = 1,
    updated_at = CURRENT_TIMESTAMP
WHERE provider_key = 'niazpardaz';
