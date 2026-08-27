const NIAZPARDAZ_BASE_URL = "https://login.niazpardaz.ir/api/v2/RestWebApi";
const SMSIR_VERIFY_URL = "https://api.sms.ir/v1/send/verify";

export async function getDefaultSmsProvider(db) {
  const result = await db.prepare(
    `SELECT id, key, name, is_enabled, is_default, sender_number, settings_json
     FROM sms_providers
     WHERE is_enabled = 1
     ORDER BY is_default DESC, id ASC
     LIMIT 1`
  ).first();
  if (!result) throw new Error("هیچ Provider پیامکی فعالی تنظیم نشده است.");
  return result;
}

export async function getSmsProvider(db, key) {
  const result = await db.prepare(
    `SELECT id, key, name, is_enabled, is_default, sender_number, settings_json
     FROM sms_providers
     WHERE key = ? AND is_enabled = 1
     LIMIT 1`
  ).bind(key).first();
  if (!result) throw new Error(`Provider پیامکی فعال نیست: ${key}`);
  return result;
}

export async function getSmsTemplate(db, providerId, purpose) {
  return db.prepare(
    `SELECT id, provider_id, purpose, name, template_id, message_template, variables_json, settings_json, is_enabled
     FROM sms_templates
     WHERE provider_id = ? AND purpose = ? AND is_enabled = 1
     ORDER BY is_default DESC, id ASC
     LIMIT 1`
  ).bind(providerId, purpose).first();
}

export async function createSmsLog(db, input) {
  const result = await db.prepare(
    `INSERT INTO sms_logs (
      provider_id, lead_id, purpose, recipient, sender, template_id,
      message, send_status, delivery_status, provider_message_id,
      provider_code, provider_status, provider_response, error_message,
      sent_at, delivered_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'unknown', ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    input.providerId,
    input.leadId ?? null,
    input.purpose,
    input.recipient,
    input.sender ?? null,
    input.templateId ?? null,
    input.message ?? null,
    input.providerMessageId ?? null,
    input.providerCode ?? null,
    input.providerStatus ?? null,
    input.providerResponse ? JSON.stringify(input.providerResponse) : null,
    input.errorMessage ?? null,
    input.sentAt ?? null,
    input.deliveredAt ?? null
  ).run();
  return result.meta?.last_row_id;
}

export async function updateSmsLog(db, id, patch) {
  const fields = [];
  const values = [];
  const allowed = [
    "send_status", "delivery_status", "provider_message_id", "provider_code",
    "provider_status", "provider_response", "error_message", "sent_at", "delivered_at"
  ];
  for (const key of allowed) {
    if (patch[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(patch[key] === null || typeof patch[key] !== "object" ? patch[key] : JSON.stringify(patch[key]));
    }
  }
  if (!fields.length) return;
  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);
  await db.prepare(`UPDATE sms_logs SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
}

export async function sendLeadSms({ env, db, provider, template, leadId, purpose, recipient, parameters, message }) {
  const sender = provider.sender_number || null;
  const logId = await createSmsLog(db, {
    providerId: provider.id,
    leadId,
    purpose,
    recipient,
    sender,
    templateId: template?.template_id ?? null,
    message: message ?? template?.message_template ?? null,
  });

  try {
    let result;
    if (provider.key === "sms_ir") {
      result = await sendSmsIr({
        apiKey: env.SMSIR_API_KEY,
        mobile: recipient,
        templateId: Number(template?.template_id || 0),
        parameters,
      });
    } else if (provider.key === "niazpardaz") {
      const rendered = renderTemplate(template?.message_template || message || "", parameters);
      result = await sendNiazpardaz({
        apiKey: env.NIAZPARDAZ_API_KEY,
        fromNumber: sender || env.NIAZPARDAZ_SENDER_NUMBER,
        toNumber: recipient,
        message: rendered,
      });
    } else {
      throw new Error(`Provider ناشناخته: ${provider.key}`);
    }

    await updateSmsLog(db, logId, {
      send_status: result.success ? "sent" : "failed",
      delivery_status: result.success ? "pending" : "unknown",
      provider_message_id: result.messageId ?? null,
      provider_code: result.code === undefined || result.code === null ? null : String(result.code),
      provider_status: result.status === undefined || result.status === null ? null : String(result.status),
      provider_response: result.data ?? result.raw ?? null,
      error_message: result.success ? null : (result.errorMessage || result.error || "ارسال پیامک ناموفق بود"),
      sent_at: result.success ? new Date().toISOString() : null,
    });

    return { ...result, logId };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "خطای ناشناخته در ارسال پیامک";
    await updateSmsLog(db, logId, {
      send_status: "failed",
      delivery_status: "unknown",
      error_message: messageText,
      provider_response: { exception: messageText },
    });
    return { success: false, status: 0, error: messageText, logId };
  }
}

async function sendSmsIr({ apiKey, mobile, templateId, parameters }) {
  if (!apiKey) throw new Error("SMSIR_API_KEY تنظیم نشده است.");
  if (!templateId) throw new Error("Template ID مربوط به SMS.ir تنظیم نشده است.");
  const response = await fetch(SMSIR_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ mobile, templateId, parameters }),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  const messageId = data?.data?.messageId ?? data?.data?.messageID ?? data?.data?.id ?? null;
  return {
    success: response.ok,
    status: response.status,
    messageId,
    code: data?.status,
    data,
    errorMessage: data?.message,
  };
}

async function sendNiazpardaz({ apiKey, fromNumber, toNumber, message }) {
  if (!apiKey) throw new Error("NIAZPARDAZ_API_KEY تنظیم نشده است.");
  if (!fromNumber) throw new Error("NIAZPARDAZ_SENDER_NUMBER تنظیم نشده است.");
  if (!message) throw new Error("متن پیامک نیازپرداز تنظیم نشده است.");
  const response = await fetch(`${NIAZPARDAZ_BASE_URL}/SendBatchSms`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ fromNumber, messageContent: message, toNumbers: toNumber, isFlash: false }),
  });
  const text = await response.text();
  let envelope;
  try { envelope = JSON.parse(text); } catch { envelope = { raw: text }; }
  if (!response.ok) {
    return { success: false, status: response.status, data: envelope, errorMessage: envelope?.errorMessage || `HTTP ${response.status}` };
  }
  const result = envelope?.result ?? envelope;
  const code = result?.resultCode;
  return {
    success: code === 0,
    status: response.status,
    messageId: result?.batchSmsId ?? null,
    code,
    data: envelope,
    errorMessage: code === 0 ? null : `Niazpardaz resultCode=${code}`,
  };
}

export async function refreshSmsDelivery({ env, db, log }) {
  if (!log?.provider_message_id) throw new Error("برای این SMS شناسه Provider وجود ندارد.");
  const provider = await db.prepare(`SELECT * FROM sms_providers WHERE id = ? LIMIT 1`).bind(log.provider_id).first();
  if (!provider) throw new Error("Provider مربوط به SMS پیدا نشد.");

  if (provider.key === "niazpardaz") {
    return refreshNiazpardazDelivery(env, db, log);
  }
  if (provider.key === "sms_ir") {
    return refreshSmsIrDelivery(env, db, log);
  }
  throw new Error(`Provider ناشناخته: ${provider.key}`);
}

async function refreshNiazpardazDelivery(env, db, log) {
  if (!env.NIAZPARDAZ_API_KEY) throw new Error("NIAZPARDAZ_API_KEY تنظیم نشده است.");
  const response = await fetch(`${NIAZPARDAZ_BASE_URL}/GetBatchDelivery`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": env.NIAZPARDAZ_API_KEY },
    body: JSON.stringify({ batchSmsId: Number(log.provider_message_id), index: 1, count: 100 }),
  });
  const text = await response.text();
  let envelope;
  try { envelope = JSON.parse(text); } catch { envelope = { raw: text }; }
  if (!response.ok) throw new Error(`Niazpardaz delivery HTTP ${response.status}`);
  const result = envelope?.result ?? envelope;
  if (result?.resultCode !== 0) {
    await updateSmsLog(db, log.id, { provider_response: envelope, provider_code: String(result?.resultCode ?? ""), delivery_status: "unknown", error_message: result?.errorMessage || null });
    return { success: false, data: envelope };
  }
  const numbers = result?.numbers || [];
  const statuses = result?.deliveryStatus || [];
  const index = numbers.findIndex((n) => normalizeIranMobile(n) === normalizeIranMobile(log.recipient));
  const statusCode = index >= 0 ? Number(statuses[index]) : null;
  const deliveryStatus = mapNiazDeliveryStatus(statusCode);
  await updateSmsLog(db, log.id, {
    delivery_status: deliveryStatus,
    provider_code: statusCode === null ? null : String(statusCode),
    provider_response: envelope,
    delivered_at: deliveryStatus === "delivered" ? new Date().toISOString() : null,
  });
  return { success: true, deliveryStatus, providerCode: statusCode, data: envelope };
}

async function refreshSmsIrDelivery(env, db, log) {
  if (!env.SMSIR_API_KEY) throw new Error("SMSIR_API_KEY تنظیم نشده است.");
  const response = await fetch(`https://api.sms.ir/v1/send/${encodeURIComponent(log.provider_message_id)}`, {
    headers: { Accept: "application/json", "x-api-key": env.SMSIR_API_KEY },
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(data?.message || `SMS.ir delivery HTTP ${response.status}`);
  const state = data?.data?.deliveryState ?? data?.data?.deliveryStatus ?? data?.data?.status ?? null;
  const deliveryStatus = mapSmsIrDeliveryState(state);
  await updateSmsLog(db, log.id, {
    delivery_status: deliveryStatus,
    provider_code: data?.status === undefined ? null : String(data.status),
    provider_response: data,
    delivered_at: deliveryStatus === "delivered" ? new Date().toISOString() : null,
  });
  return { success: true, deliveryStatus, data };
}

function mapNiazDeliveryStatus(code) {
  if (code === 1) return "delivered";
  if ([2, 3, 6, 7, 9, 10, 11].includes(code)) return "failed";
  if ([0, 4, 5, 8, 13].includes(code)) return "pending";
  return "unknown";
}

function mapSmsIrDeliveryState(value) {
  if (value === null || value === undefined) return "unknown";
  const normalized = String(value).toLowerCase();
  if (["delivered", "delivery", "2", "3", "success"].includes(normalized)) return "delivered";
  if (["failed", "notdelivered", "rejected", "error", "4", "5"].includes(normalized)) return "failed";
  if (["pending", "queued", "sent", "inqueue", "1"].includes(normalized)) return "pending";
  return "unknown";
}

function renderTemplate(template, parameters = []) {
  let output = String(template || "");
  for (const parameter of parameters) {
    const name = String(parameter?.name || "");
    const value = String(parameter?.value ?? "");
    if (!name) continue;
    output = output.replaceAll(`{${name}}`, value).replaceAll(`{{${name}}}`, value);
  }
  return output;
}

function normalizeIranMobile(value) {
  let phone = String(value || "").trim().replace(/\s+/g, "").replace(/-/g, "");
  if (phone.startsWith("+98")) phone = "0" + phone.slice(3);
  else if (phone.startsWith("98") && phone.length === 12) phone = "0" + phone.slice(2);
  return phone;
}
