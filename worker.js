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

    if (url.pathname === "/admin/" || url.pathname === "/admin/index.html") {
      const cache = caches.default;
      await cache.delete(request);

      const assetUrl = new URL(request.url);
      assetUrl.pathname = "/admin/index.html";
      assetUrl.search = `?admin-build=${Date.now()}`;

      const assetRequest = new Request(assetUrl.toString(), {
        method: "GET",
        headers: request.headers,
      });

      const response = await env.ASSETS.fetch(assetRequest);
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/html")) {
        let html = await response.text();
        html = html.replace(/<script[^>]+src=["']\.\.\/js\/admin-analytics\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi, "");
        html = html.replace(/<script[^>]+src=["']\.\.\/js\/admin-cloudflare(?:-loader)?\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi, "");
        html = html.replace(/<script[^>]+src=["']\.\.\/js\/admin-web-analytics\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi, "");
        const adminScripts = '<script src="../js/admin-analytics.js?v=9"></script><script src="../js/admin-cloudflare.js?v=9"></script><script src="../js/admin-web-analytics.js?v=1"></script>';
        if (html.includes("</body>")) html = html.replace("</body>", `${adminScripts}</body>`);
        else html += adminScripts;
        const headers = new Headers(response.headers);
        headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
        headers.set("Pragma", "no-cache");
        headers.delete("ETag");
        headers.delete("Expires");
        return new Response(html, { status: response.status, statusText: response.statusText, headers });
      }
      return response;
    }

    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    if (url.pathname === "/api/admin/analytics/bing/callback") {
      const response = await handleBingApi(request, env);
      return withCors(response, origin);
    }

    if (url.pathname.startsWith("/api/admin/analytics/bing/")) {
      const response = await handleBingApi(request, env);
      return withCors(response, origin);
    }

    if (url.pathname === "/api/admin/analytics/cloudflare/data" || url.pathname === "/api/admin/analytics/cloudflare/web/data") {
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
      if (!fullName) return jsonResponse({ success: false, error: "نام و نام خانوادگی الزامی است." }, 400);
      if (!phone) return jsonResponse({ success: false, error: "شماره تماس الزامی است." }, 400);
      const normalizedPhone = normalizeIranMobile(phone);
      if (!normalizedPhone) return jsonResponse({ success: false, error: "شماره موبایل معتبر نیست." }, 400);
      const adminMobile = normalizeIranMobile(env.ADMIN_MOBILE);
      if (!adminMobile) return jsonResponse({ success: false, error: "ADMIN_MOBILE معتبر نیست." }, 500);
      const safeFullName = limitForPattern(fullName);
      const safeBrand = limitForPattern(brand);
      const safeType = limitForPattern(type);
      const safeDescription = limitForPattern(description);
      const insertResult = await env.DB.prepare(`INSERT INTO leads (full_name, phone, brand, type, description, source, customer_sms_status, admin_sms_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(safeFullName, normalizedPhone, safeBrand, safeType, safeDescription, source || "homepage", "pending", "pending").run();
      const leadId = insertResult.meta?.last_row_id;
      if (!leadId) return jsonResponse({ success: false, error: "ذخیره درخواست انجام نشد." }, 500);
