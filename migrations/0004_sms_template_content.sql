PRAGMA foreign_keys = ON;

-- Approved SMS.ir templates. The message_text column is the admin-side
-- representation of the provider pattern; template_ref is the real SMS.ir
-- Pattern/Template ID used by the API.
UPDATE sms_templates
SET template_ref = '415557',
    message_text = 'جهت تست
سلام #FULLNAME# عزیز 🌱
درخواست مشاوره شما با موفقیت دریافت شد.
به‌زودی با شما تماس می‌گیریم تا بیشتر درباره نیازتون صحبت کنیم.',
    variables_json = '[{"name":"FULLNAME","description":"نام و نام خانوادگی کاربر"}]',
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = (SELECT id FROM sms_providers WHERE provider_key = 'sms_ir')
  AND purpose = 'lead_customer';

UPDATE sms_templates
SET template_ref = '861597',
    message_text = 'جهت تست
🔔 مشاوره جدید
نام:#FULLNAME#
تلفن:#PHONE#
برند:#BRAND#
نیاز:#TYPE#
توضیح:#DESCRIPTION#',
    variables_json = '[{"name":"FULLNAME","description":"نام و نام خانوادگی کاربر"},{"name":"PHONE","description":"شماره تماس"},{"name":"BRAND","description":"نام برند یا نام کسب‌وکار متقاضی"},{"name":"TYPE","description":"نوع درخواست یا نیاز مشتری"},{"name":"DESCRIPTION","description":"توضیحات و شرح درخواست مشتری"}]',
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = (SELECT id FROM sms_providers WHERE provider_key = 'sms_ir')
  AND purpose = 'lead_admin';

-- Niazpardaz sends the complete rendered text, so there is no provider
-- Pattern ID. The placeholders are local application variables and can be
-- renamed from the admin panel later without changing the provider API.
UPDATE sms_templates
SET template_ref = NULL,
    message_text = '🔔 مشاوره جدید
نام: {FULLNAME}
تلفن: {PHONE}
برند: {BRAND}
نیاز: {TYPE}
توضیح: {DESCRIPTION}',
    variables_json = '[{"name":"FULLNAME","description":"نام و نام خانوادگی کاربر"},{"name":"PHONE","description":"شماره تماس"},{"name":"BRAND","description":"نام برند یا نام کسب‌وکار متقاضی"},{"name":"TYPE","description":"نوع درخواست یا نیاز مشتری"},{"name":"DESCRIPTION","description":"توضیحات و شرح درخواست مشتری"}]',
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = (SELECT id FROM sms_providers WHERE provider_key = 'niazpardaz')
  AND purpose = 'lead_admin';

UPDATE sms_templates
SET template_ref = NULL,
    message_text = 'سلام {FULLNAME} عزیز 🌱
درخواست مشاوره شما با موفقیت دریافت شد.
به‌زودی با شما تماس می‌گیریم تا بیشتر درباره نیازتون صحبت کنیم.',
    variables_json = '[{"name":"FULLNAME","description":"نام و نام خانوادگی کاربر"}]',
    updated_at = CURRENT_TIMESTAMP
WHERE provider_id = (SELECT id FROM sms_providers WHERE provider_key = 'niazpardaz')
  AND purpose = 'lead_customer';
