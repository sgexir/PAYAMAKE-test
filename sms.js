const SMSIR_VERIFY_URL = "https://api.sms.ir/v1/send/verify";
const SMSIR_REPORT_URL = "https://api.sms.ir/v1/send/";
const NIAZPARDAZ_BASE_URL = "https://login.niazpardaz.ir/api/v2/RestWebApi";

export async function sendLeadSms({ env, db, leadId, recipient, purpose, parameters, message }) {
  const configuredProviderKey = String(env.SMS_PROVIDER_DEFAULT || "").trim().toLowerCase();
  const providerKey = configuredProviderKey || await getDefaultProviderKey(db);
  const provider = await getProvider(db, providerKey);
  if (!provider || !provider.is_enabled) throw new Error(`SMS provider is not configured or disabled: ${providerKey}`);

  const template = await getTemplate(db, provider.id, purpose);
  const templateRef = template?.template_ref || getEnvTemplateRef(env, providerKey, purpose);
  const renderedMessage = renderTemplate(template?.message_text || message || "", parameters);
  const sender = provider.sender_number || (providerKey === "niazpardaz" ? env.NIAZPARDAZ_SENDER_NUMBER || null : null);
  const logId = await createSmsLog(db, { providerId: provider.id, leadId, purpose, recipient, sender, templateId: templateRef, message: renderedMessage });

  try {
    const result = providerKey === "sms_ir" ? await sendSmsIr(env, recipient, templateRef, parameters) : await sendNiazpardaz(env, recipient, sender, renderedMessage);
    await updateSmsLog(db, logId, { sendStatus: result.success ? "sent" : "failed", providerMessageId: result.providerMessageId || null, providerCode: result.providerCode == null ? null : String(result.providerCode), providerStatus: result.providerStatus || null, providerResponse: result.raw, errorMessage: result.success ? null : result.errorMessage, sentAt: result.success ? new Date().toISOString() : null, deliveryStatus: result.success ? "pending" : "unknown" });
    return { ...result, logId, providerKey };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    await updateSmsLog(db, logId, { sendStatus: "failed", providerResponse: { exception: messageText }, errorMessage: messageText });
    return { success: false, logId, providerKey, errorMessage: messageText };
  }
}

export async function refreshPendingSmsDeliveries(env) {
  if (!env.DB) return { checked: 0, updated: 0, errors: [], byProvider: {} };
  const rows = await env.DB.prepare(`
    SELECT l.*, p.provider_key, p.is_enabled
    FROM sms_logs l JOIN sms_providers p ON p.id = l.provider_id
    WHERE l.send_status = 'sent' AND l.delivery_status IN ('pending', 'unknown')
      AND l.provider_message_id IS NOT NULL
    ORDER BY l.created_at ASC LIMIT 100
  `).all();

  let updated = 0;
  const errors = [];
  const byProvider = {};
  for (const row of rows.results || []) {
    const key = String(row.provider_key || "unknown");
    byProvider[key] = byProvider[key] || { checked: 0, updated: 0, errors: 0 };
    byProvider[key].checked++;
    try {
      const report = key === "sms_ir" ? await getSmsIrDelivery(env, row.provider_message_id) : key === "niazpardaz" ? await getNiazpardazDelivery(env, row.provider_message_id) : null;
      if (!report) throw new Error(`Delivery API برای Provider ${key} در دسترس نیست.`);
      if (report.errorMessage) throw new Error(report.errorMessage);
      if (!report.hasStatus) continue;
      await updateSmsLog(env.DB, row.id, {
        deliveryStatus: report.deliveryStatus,
        providerStatus: report.providerStatus || null,
        providerCode: report.providerCode == null ? row.provider_code : String(report.providerCode),
        providerResponse: report.raw,
        deliveredAt: report.deliveryStatus === "delivered" ? new Date().toISOString() : null,
      });
      updated++;
      byProvider[key].updated++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      byProvider[key].errors++;
      errors.push({ id: row.id, provider: key, message });
      console.error("SMS delivery refresh error:", row.id, key, error);
    }
  }
  return { checked: (rows.results || []).length, updated, errors, byProvider };
}

async function getDefaultProviderKey(db) {
  const row = await db.prepare(`SELECT provider_key FROM sms_providers WHERE is_enabled = 1 ORDER BY is_default DESC, id ASC LIMIT 1`).first();
  return String(row?.provider_key || "niazpardaz").trim().toLowerCase();
}
async function getProvider(db, providerKey) { return db.prepare(`SELECT * FROM sms_providers WHERE provider_key = ? LIMIT 1`).bind(providerKey).first(); }
async function getTemplate(db, providerId, purpose) { return db.prepare(`SELECT * FROM sms_templates WHERE provider_id = ? AND purpose = ? AND is_enabled = 1 ORDER BY is_default DESC, id ASC LIMIT 1`).bind(providerId, purpose).first(); }

async function createSmsLog(db, data) {
  const result = await db.prepare(`INSERT INTO sms_logs (provider_id, lead_id, purpose, recipient, sender, template_id, message, send_status, delivery_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'unknown', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).bind(data.providerId, data.leadId || null, data.purpose, data.recipient, data.sender || null, data.templateId || null, data.message || null).run();
  return result.meta.last_row_id;
}

async function updateSmsLog(db, id, data) {
  const map = { sendStatus: "send_status", deliveryStatus: "delivery_status", providerMessageId: "provider_message_id", providerCode: "provider_code", providerStatus: "provider_status", providerResponse: "provider_response", errorMessage: "error_message", sentAt: "sent_at", deliveredAt: "delivered_at" };
  const fields = [], values = [];
  for (const [key, value] of Object.entries(data)) {
    if (!(key in map)) continue;
    fields.push(`${map[key]} = ?`);
    values.push(value == null ? null : typeof value === "object" ? JSON.stringify(value) : value);
  }
  if (!fields.length) return;
  fields.push("updated_at = CURRENT_TIMESTAMP"); values.push(id);
  await db.prepare(`UPDATE sms_logs SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
}

async function sendNiazpardaz(env, recipient, sender, message) {
  if (!env.NIAZPARDAZ_API_KEY) throw new Error("NIAZPARDAZ_API_KEY تنظیم نشده است.");
  if (!sender) throw new Error("NIAZPARDAZ_SENDER_NUMBER تنظیم نشده است.");
  if (!message) throw new Error("متن پیامک نیازپرداز تنظیم نشده است.");
  const response = await fetch(`${NIAZPARDAZ_BASE_URL}/SendBatchSms`, { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": env.NIAZPARDAZ_API_KEY }, body: JSON.stringify({ fromNumber: sender, messageContent: message, toNumbers: recipient, isFlash: false }) });
  const text = await response.text(), raw = parseJson(text), result = raw?.result || raw;
  const code = result?.resultCode ?? raw?.resultCode ?? null;
  const success = response.ok && raw?.success !== false && Number(code) === 0;
  return { success, status: response.status, providerMessageId: result?.batchSmsId ?? result?.batchSMSId ?? null, providerCode: code, providerStatus: success ? "accepted" : "rejected", raw, errorMessage: success ? null : (raw?.errorMessage || `Niazpardaz result code: ${code}`) };
}

async function getNiazpardazDelivery(env, batchSmsId) {
  if (!env.NIAZPARDAZ_API_KEY) return { hasStatus: false, errorMessage: "NIAZPARDAZ_API_KEY تنظیم نشده است." };
  const response = await fetch(`${NIAZPARDAZ_BASE_URL}/GetBatchDelivery`, { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": env.NIAZPARDAZ_API_KEY }, body: JSON.stringify({ batchSmsId: Number(batchSmsId), index: 1, count: 100 }) });
  const text = await response.text(), raw = parseJson(text), result = raw?.result || raw;
  if (!response.ok || raw?.success === false) return { hasStatus: false, raw, errorMessage: raw?.errorMessage || `Niazpardaz Delivery HTTP ${response.status}` };
  const statuses = result?.deliveryStatus || result?.deliveryStatuses || [];
  const status = Array.isArray(statuses) ? Number(statuses[0]) : Number(statuses);
  const map = { 1: "delivered", 2: "failed", 3: "failed", 7: "failed", 9: "failed", 10: "failed", 11: "failed", 13: "pending", 0: "pending", 5: "pending", 6: "failed", 8: "unknown", 12: "failed" };
  return { hasStatus: true, deliveryStatus: map[status] || "unknown", providerStatus: String(status), providerCode: result?.resultCode ?? raw?.resultCode ?? null, raw };
}

async function sendSmsIr(env, recipient, templateId, parameters) {
  if (!env.SMSIR_API_KEY) throw new Error("SMSIR_API_KEY تنظیم نشده است.");
  const id = Number(templateId || 0);
  if (!id) throw new Error("SMS.ir template ID تنظیم نشده است.");
  const response = await fetch(SMSIR_VERIFY_URL, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": env.SMSIR_API_KEY }, body: JSON.stringify({ mobile: recipient, templateId: id, parameters: parameters || [] }) });
  const text = await response.text(), raw = parseJson(text), messageId = raw?.data?.messageId ?? raw?.data?.messageID ?? null;
  return { success: response.ok, status: response.status, providerMessageId: messageId, providerCode: raw?.status ?? response.status, providerStatus: response.ok ? "accepted" : "rejected", raw, errorMessage: response.ok ? null : (raw?.message || `SMS.ir HTTP ${response.status}`) };
}

async function getSmsIrDelivery(env, messageId) {
  if (!env.SMSIR_API_KEY) return { hasStatus: false, errorMessage: "SMSIR_API_KEY تنظیم نشده است." };
  const response = await fetch(`${SMSIR_REPORT_URL}${encodeURIComponent(messageId)}`, { headers: { Accept: "application/json", "x-api-key": env.SMSIR_API_KEY } });
  const text = await response.text(), raw = parseJson(text);
  if (!response.ok) return { hasStatus: false, raw, errorMessage: raw?.message || `SMS.ir Delivery HTTP ${response.status}` };
  const data = raw?.data || raw, state = data?.deliveryState;
  if (state == null) return { hasStatus: false, raw, errorMessage: "SMS.ir پاسخ Delivery بدون deliveryState برگرداند." };
  const map = { 1: "delivered", 2: "failed", 3: "failed", 4: "unknown", 5: "pending", 6: "failed", 7: "failed", 8: "unknown" };
  return { hasStatus: true, deliveryStatus: map[state] || "unknown", providerStatus: String(state), providerCode: raw?.status ?? null, raw };
}

function getEnvTemplateRef(env, providerKey, purpose) { if (providerKey !== "sms_ir") return null; return purpose === "lead_customer" ? env.SMSIR_CUSTOMER_TEMPLATE_ID : env.SMSIR_ADMIN_TEMPLATE_ID; }
function renderTemplate(template, parameters) { let text = String(template || ""); for (const parameter of parameters || []) { const name = String(parameter?.name || ""); if (name) text = text.replaceAll(`{${name}}`, String(parameter?.value ?? "")); } return text; }
function parseJson(text) { try { return JSON.parse(text); } catch { return { raw: text }; } }