import { handleAdminAuth } from "./auth.js";
import { getDefaultSmsProvider, getSmsTemplate, sendLeadSms, refreshSmsDelivery } from "./sms.js";

const ALLOWED_ORIGIN = "https://staging.payamake.ir";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname.startsWith("/api/admin/")) {
      const response = await handleAdminAuth(request, env);
      return withCors(response, origin);
    }

    if (request.method !== "POST") {
      return jsonResponse({ success: false, error: "Method Not Allowed" }, 405, origin);
    }

    try {
      if (!env.ADMIN_MOBILE) return jsonResponse({ success: false, error: "ADMIN_MOBILE تنظیم نشده است." }, 500, origin);
      if (!env.DB) return jsonResponse({ success: false, error: "اتصال D1 با نام DB تنظیم نشده است." }, 500, origin);

      let body;
      try { body = await request.json(); } catch { return jsonResponse({ success: false, error: "داده ارسالی معتبر نیست." }, 400, origin); }

      const fullName = String(body.fullName || "").trim();
      const phone = String(body.phone || "").trim();
      const brand = String(body.brand || "").trim();
      const type = String(body.type || "").trim();
      const description = String(body.description || "").trim();
      const source = String(body.source || "homepage").trim();

      if (!fullName) return jsonResponse({ success: false, error: "نام و نام خانوادگی الزامی است." }, 400, origin);
      if (!phone) return jsonResponse({ success: false, error: "شماره تماس الزامی است." }, 400, origin);

      const normalizedPhone = normalizeIranMobile(phone);
      if (!normalizedPhone) return jsonResponse({ success: false, error: "شماره موبایل معتبر نیست." }, 400, origin);

      const adminMobile = normalizeIranMobile(env.ADMIN_MOBILE);
      if (!adminMobile) return jsonResponse({ success: false, error: "ADMIN_MOBILE معتبر نیست." }, 500, origin);

      const safeFullName = limitForPattern(fullName);
      const safeBrand = limitForPattern(brand);
      const safeType = limitForPattern(type);
      const safeDescription = limitForPattern(description);

      const insertResult = await env.DB.prepare(
        `INSERT INTO leads (full_name, phone, brand, type, description, source, customer_sms_status, admin_sms_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(safeFullName, normalizedPhone, safeBrand, safeType, safeDescription, source || "homepage", "pending", "pending").run();

      const leadId = insertResult.meta?.last_row_id;
      if (!leadId) return jsonResponse({ success: false, error: "ذخیره درخواست انجام نشد." }, 500, origin);

      const provider = await getDefaultSmsProvider(env.DB);
      const customerTemplate = (await getSmsTemplate(env.DB, provider.id, "lead_customer")) || {};
      const adminTemplate = (await getSmsTemplate(env.DB, provider.id, "lead_admin")) || {};

      if (provider.key === "sms_ir") {
        customerTemplate.template_id = customerTemplate.template_id || env.SMSIR_CUSTOMER_TEMPLATE_ID || null;
        adminTemplate.template_id = adminTemplate.template_id || env.SMSIR_ADMIN_TEMPLATE_ID || null;
      }
      if (provider.key === "niazpardaz") {
        customerTemplate.message_template = customerTemplate.message_template || env.NIAZPARDAZ_CUSTOMER_MESSAGE || null;
        adminTemplate.message_template = adminTemplate.message_template || env.NIAZPARDAZ_ADMIN_MESSAGE || null;
      }

      const customerResult = await sendLeadSms({
        env,
        db: env.DB,
        provider,
        template: customerTemplate,
        leadId,
        purpose: "lead_customer",
        recipient: normalizedPhone,
        parameters: [{ name: "FULLNAME", value: safeFullName }],
      });
      await updateLeadSmsStatus(env.DB, leadId, "customer_sms_status", customerResult.success ? "sent" : "failed");

      const adminResult = await sendLeadSms({
        env,
        db: env.DB,
        provider,
        template: adminTemplate,
        leadId,
        purpose: "lead_admin",
        recipient: adminMobile,
        parameters: [
          { name: "FULLNAME", value: safeFullName },
          { name: "PHONE", value: normalizedPhone },
          { name: "BRAND", value: safeBrand },
          { name: "TYPE", value: safeType },
          { name: "DESCRIPTION", value: safeDescription },
        ],
      });
      await updateLeadSmsStatus(env.DB, leadId, "admin_sms_status", adminResult.success ? "sent" : "failed");

      return jsonResponse({
        success: customerResult.success && adminResult.success,
        leadId,
        provider: provider.key,
        customerSms: { sent: customerResult.success, status: customerResult.status, logId: customerResult.logId },
        adminSms: { sent: adminResult.success, status: adminResult.status, logId: adminResult.logId },
      }, 200, origin);
    } catch (error) {
      console.error("Worker error:", error);
      return jsonResponse({ success: false, error: error instanceof Error ? error.message : "خطای ناشناخته" }, 500, origin);
    }
  },

  async scheduled(event, env, ctx) {
    if (!env.DB) return;
    const pending = await env.DB.prepare(
      `SELECT id, provider_id, lead_id, purpose, recipient, provider_message_id
       FROM sms_logs
       WHERE send_status = 'sent' AND delivery_status = 'pending'
         AND provider_message_id IS NOT NULL
       ORDER BY created_at ASC
       LIMIT 50`
    ).all();

    for (const log of pending.results || []) {
      ctx.waitUntil(
        refreshSmsDelivery({ env, db: env.DB, log })
          .then((result) => {
            if (!result?.deliveryStatus || !log.lead_id) return;
            const column = log.purpose === "lead_customer" ? "customer_sms_status" : log.purpose === "lead_admin" ? "admin_sms_status" : null;
            if (!column) return;
            return updateLeadSmsStatus(env.DB, log.lead_id, column, result.deliveryStatus === "delivered" ? "delivered" : result.deliveryStatus === "failed" ? "failed" : "sent");
          })
          .catch((error) => {
            console.error("SMS delivery refresh error:", { logId: log.id, error: error instanceof Error ? error.message : error });
          })
      );
    }
  },
};

async function updateLeadSmsStatus(db, leadId, column, status) {
  const allowedColumns = ["customer_sms_status", "admin_sms_status"];
  if (!allowedColumns.includes(column)) throw new Error("Invalid SMS status column.");
  await db.prepare(`UPDATE leads SET ${column} = ? WHERE id = ?`).bind(status, leadId).run();
}

function normalizeIranMobile(value) {
  let phone = String(value || "").trim().replace(/\s+/g, "").replace(/-/g, "");
  if (phone.startsWith("+98")) phone = "0" + phone.slice(3);
  else if (phone.startsWith("98") && phone.length === 12) phone = "0" + phone.slice(2);
  return /^09\d{9}$/.test(phone) ? phone : null;
}

function limitForPattern(value) { return String(value || "").slice(0, 40); }

function corsHeaders(origin) {
  const allowedOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

function withCors(response, origin) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(origin))) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function jsonResponse(data, status = 200, origin = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8", ...corsHeaders(origin) },
  });
}
