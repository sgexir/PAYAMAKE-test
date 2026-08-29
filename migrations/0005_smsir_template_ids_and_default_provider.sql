PRAGMA foreign_keys = ON;

-- SMS.ir approved Pattern IDs after provider-side template update.
-- Keep the provider enabled; only the default routing is moved to Niazpardaz.
UPDATE sms_templates
SET template_ref = '925624',
    message_text = 'سلام {FULLNAME} عزیز 🌱
درخواست مشاوره شما با موفقیت دریافت شد.
به‌زودی با شما تماس می‌گیریم تا بیشتر درباره نیازتون صحبت کنیم.',
    variables_json = '[{"name":"FULLNAME","description":"نام و نام خانوادگی کاربر"}]',
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = (SELECT id FROM sms_providers WHERE provider_key = 'sms_ir')
  AND purpose = 'lead_customer';

UPDATE sms_templates
SET template_ref = '511007',
    message_text = '🔔 مشاوره جدید
نام:{FULLNAME}
تلفن:{PHONE}',
    variables_json = '[{"name":"FULLNAME","description":"نام و نام خانوادگی کاربر"},{"name":"PHONE","description":"شماره تماس"}]',
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = (SELECT id FROM sms_providers WHERE provider_key = 'sms_ir')
  AND purpose = 'lead_admin';

-- Keep SMS.ir available, but route new sends through Niazpardaz by default.
UPDATE sms_providers SET is_default = 0, updated_at = CURRENT_TIMESTAMP;
UPDATE sms_providers
SET is_default = 1, updated_at = CURRENT_TIMESTAMP
WHERE provider_key = 'niazpardaz';
