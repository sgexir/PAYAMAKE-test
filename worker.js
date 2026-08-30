import { handleAdminAuth } from "./auth.js";
import { handleAdminApi } from "./admin-api.js";
import { handleLeadsApi } from "./leads-api.js";
import { handleMonitoringApi, getMonitoringSetting, writeMonitoringError, ensureMonitoringSettings } from "./monitoring-api.js";
import { handleHealthApi } from "./health-api.js";
import { handleBingApi } from "./bing-api.js";
import { handleCloudflareAnalytics } from "./cloudflare-api.js";
import { sendLeadSms, refreshPendingSmsDeliveries } from "./sms.js";

const ALLOWED_ORIGIN = "https://staging.payamake.ir";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    if (url.pathname === "/api/admin/analytics/bing/callback") {
      const response = await handleBingApi(request, env);
      return withCors(response, origin);
    }

    if (url.pathname.startsWith("/api/admin/analytics/bing/")) {
      const response = await handleBingApi(request, env);
      return withCors(response, origin);
    }

    if (url.pathname === "/api/admin/analytics/cloudflare/data") {
      const response = await handleCloudflareAnalytics(request, env);
      return withCors(response, origin);
    }

    if (url.pathname === "/api/admin/system/health") {
      const response = await handleHealthApi(request, env);
      return withCors(response, origin);
    }

    if (url.pathname === "/api/admin/system/settings") {
      const adminResponse = await handleAdminApi(request, env);
      if (adminResponse.status === 401) return withCors(adminResponse, origin);
      const response = await handleMonitoringApi(request, env);
      return withCors(response, origin);
    }

    if (url.pathname.startsWith("/api/admin/leads")) {
      const response = await handleLeadsApi(request, env);
      return withCors(response, origin);
    }

    if (url.pathname.startsWith("/api/admin/sms/") || url.pathname.startsWith("/api/admin/system/")) {
      const response = await handleAdminApi(request, env);
      return withCors(response, origin);
    }

    if (url.pathname.startsWith("/api/admin/")) {
      const response = await handleAdminAuth(request, env);
      return withCors(response, origin);
    }

    if (request.method !== "POST") return jsonResponse({ success: false, error: "Method Not Allowed" }, 405, origin);

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
      const insertResult = await env.DB.prepare(`INSERT INTO leads (full_name, phone, brand, type, description, source, customer_sms_status, admin_sms_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(safeFullName, normalizedPhone, safeBrand, safeType, safeDescription, source || "homepage", "pending", "pending").run();
      const leadId = insertResult.meta?.last_row_id;
      if (!leadId) return jsonResponse({ success: false, error: "ذخیره درخواست انجام نشد." }, 500, origin);
      const customerResult = await sendLeadSms({ env, db: env.DB, leadId, recipient: normalizedPhone, purpose: "lead_customer", parameters: [{ name: "FULLNAME", value: safeFullName }], message: env.NIAZPARDAZ_CUSTOMER_MESSAGE || "سلام {FULLNAME}، درخواست شما با موفقیت ثبت شد." });
      await updateSmsStatus(env.DB, leadId, "customer_sms_status", customerResult.success ? "sent" : "failed");
      const adminResult = await sendLeadSms({ env, db: env.DB, leadId, recipient: adminMobile, purpose: "lead_admin", parameters: [{ name: "FULLNAME", value: safeFullName }, { name: "PHONE", value: normalizedPhone }, { name: "BRAND", value: safeBrand }, { name: "TYPE", value: safeType }, { name: "DESCRIPTION", value: safeDescription }], message: env.NIAZPARDAZ_ADMIN_MESSAGE || "Lead جدید: {FULLNAME} - {PHONE}" });
      await updateSmsStatus(env.DB, leadId, "admin_sms_status", adminResult.success ? "sent" : "failed");
      return jsonResponse({ success: customerResult.success && adminResult.success, leadId, customerSms: { sent: customerResult.success, provider: customerResult.providerKey, logId: customerResult.logId, status: customerResult.status, error: customerResult.errorMessage || null }, adminSms: { sent: adminResult.success, provider: adminResult.providerKey, logId: adminResult.logId, status: adminResult.status, error: adminResult.errorMessage || null } }, 200, origin);
    } catch (error) {
      console.error("Worker error:", error);
      try { if (env.DB) await writeMonitoringError(env.DB, "error", "worker", error instanceof Error ? error.message : String(error), { path: url.pathname, method: request.method, stack: error?.stack || null }); } catch (logError) { console.error("Could not persist worker error:", logError); }
      return jsonResponse({ success: false, error: error instanceof Error ? error.message : "خطای ناشناخته" }, 500, origin);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runDeliveryCron(env));
  },
};

async function runDeliveryCron(env) {
  const startedAt = Date.now();
  try {
    if (!env.DB) return;
    await ensureMonitoringSettings(env.DB);
    if ((await getMonitoringSetting(env.DB, "delivery_monitoring_enabled")) !== "1") return;

    const intervalMinutes = Math.min(Math.max(Number(await getMonitoringSetting(env.DB, "cron_interval_minutes")) || 5, 1), 1440);
    const lastRun = await env.DB.prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'cron_last_run_at' LIMIT 1").first();
    if (lastRun?.setting_value) {
      const ageMinutes = (Date.now() - Date.parse(String(lastRun.setting_value))) / 60000;
      if (Number.isFinite(ageMinutes) && ageMinutes < intervalMinutes) return;
    }
    await env.DB.prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES ('cron_last_run_at', ?) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP").bind(new Date().toISOString()).run();

    const result = await refreshPendingSmsDeliveries(env);
    const hasErrors = Boolean(result.errors?.length);
    if (hasErrors) {
      const details = { ...result, durationMs: Date.now() - startedAt, intervalMinutes };
      await writeMonitoringError(env.DB, "warn", "sms_delivery_cron", "SMS delivery cron encountered provider errors", details);
    } else if ((await getMonitoringSetting(env.DB, "log_successful_crons")) === "1") {
      await ensureSystemLogsTable(env.DB);
      await writeSystemLog(env.DB, "info", "sms_delivery_cron", "SMS delivery cron completed", { ...result, durationMs: Date.now() - startedAt, intervalMinutes });
    }
    console.log("SMS delivery cron completed", { ...result, intervalMinutes });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("SMS delivery cron failed:", error);
    try { await writeMonitoringError(env.DB, "error", "sms_delivery_cron", message, { durationMs: Date.now() - startedAt, stack: error?.stack || null }); } catch (logError) { console.error("Could not persist cron error:", logError); }
  }
}

async function ensureSystemLogsTable(db) {
  if (!db) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS system_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT NOT NULL DEFAULT 'info', source TEXT NOT NULL, event TEXT, message TEXT, details_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
}
async function writeSystemLog(db, level, source, message, details = null) {
  if (!db) return;
  await db.prepare(`INSERT INTO system_logs (level, source, event, message, details_json) VALUES (?, ?, ?, ?, ?)`).bind(level, source, source, message, details == null ? null : JSON.stringify(details)).run();
}
async function updateSmsStatus(db, leadId, column, status) {
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
function corsHeaders(origin) { const allowedOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN; return { "Access-Control-Allow-Origin": allowedOrigin, "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Credentials": "true", Vary: "Origin" }; }
function withCors(response, origin) { const headers = new Headers(response.headers); for (const [key, value] of Object.entries(corsHeaders(origin))) headers.set(key, value); return new Response(response.body, { status: response.status, statusText: response.statusText, headers }); }
function jsonResponse(data, status = 200, origin = null) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=UTF-8", ...corsHeaders(origin) } }); }
