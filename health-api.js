async function requireAdminSession(request, env) {
  const token = readCookie(request.headers.get("Cookie"), "payamake_session");
  if (!token) return null;
  const tokenHash = await sha256(decodeURIComponent(token));
  return await env.DB.prepare(`SELECT s.admin_id, a.full_name, a.email, a.is_active FROM admin_sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP AND a.is_active = 1 LIMIT 1`).bind(tokenHash).first();
}

export async function handleHealthApi(request, env) {
  if (request.method !== "GET") return json({ success: false, error: "Method Not Allowed" }, 405);
  if (!env.DB) return json({ success: false, error: "Database is not configured." }, 500);
  const admin = await requireAdminSession(request, env);
  if (!admin) return json({ success: false, error: "احراز هویت لازم است." }, 401);

  const checkedAt = new Date().toISOString();
  const checks = { worker: { status: "ok", label: "فعال", detail: "Worker در حال پاسخ‌گویی است." }, api: { status: "ok", label: "فعال", detail: "Admin API با احراز هویت در دسترس است." }, database: { status: "unknown", label: "نامشخص", detail: "" }, cron: { status: "unknown", label: "نیازمند بررسی", detail: "" } };

  try {
    const dbCheck = await env.DB.prepare("SELECT 1 AS ok").first();
    if (Number(dbCheck?.ok) === 1) checks.database = { status: "ok", label: "سالم", detail: "اتصال D1 و Query آزمایشی موفق بود." };
    else checks.database = { status: "error", label: "خطا", detail: "Query آزمایشی نتیجه معتبر نداد." };
  } catch (error) {
    checks.database = { status: "error", label: "خطا", detail: error instanceof Error ? error.message : String(error) };
  }

  let cronIntervalMinutes = 5;
  try {
    const settings = await env.DB.prepare("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('cron_last_run_at', 'cron_interval_minutes')").all();
    const settingMap = Object.fromEntries((settings.results || []).map((row) => [row.setting_key, row.setting_value]));
    cronIntervalMinutes = Math.min(Math.max(Number(settingMap.cron_interval_minutes) || 5, 1), 1440);
    const lastRunAt = settingMap.cron_last_run_at ? new Date(String(settingMap.cron_last_run_at)) : null;
    const lastRunAgeMinutes = lastRunAt && Number.isFinite(lastRunAt.getTime()) ? Math.max(0, (Date.now() - lastRunAt.getTime()) / 60000) : null;

    const latestError = await env.DB.prepare("SELECT level, message, created_at FROM system_logs WHERE source = 'sms_delivery_cron' AND level = 'error' ORDER BY id DESC LIMIT 1").first();
    const latestErrorAt = latestError?.created_at ? new Date(String(latestError.created_at).replace(" ", "T") + "Z") : null;
    const errorAfterLastRun = latestErrorAt && Number.isFinite(latestErrorAt.getTime()) && lastRunAt && Number.isFinite(lastRunAt.getTime()) && latestErrorAt.getTime() > lastRunAt.getTime();

    if (!lastRunAt || lastRunAgeMinutes === null) {
      checks.cron = { status: "unknown", label: "بدون اجرای معتبر", detail: `هنوز زمان آخرین اجرای Cron ثبت نشده است. فاصله مؤثر Cron: ${cronIntervalMinutes} دقیقه.` };
    } else if (errorAfterLastRun) {
      const errorAgeMinutes = Math.max(0, (Date.now() - latestErrorAt.getTime()) / 60000);
      checks.cron = { status: "error", label: "خطا", detail: `${latestError.message || "Cron با خطا مواجه شد"} — آخرین خطا ${Math.round(errorAgeMinutes)} دقیقه قبل، پس از آخرین اجرای ثبت‌شده.` };
    } else if (lastRunAgeMinutes > Math.max(cronIntervalMinutes * 2, 15)) {
      checks.cron = { status: "warn", label: "قدیمی", detail: `آخرین اجرای Cron حدود ${Math.round(lastRunAgeMinutes)} دقیقه قبل ثبت شده است؛ فاصله مؤثر Cron: ${cronIntervalMinutes} دقیقه.` };
    } else {
      checks.cron = { status: "ok", label: "سالم", detail: `آخرین اجرای Cron حدود ${Math.round(lastRunAgeMinutes)} دقیقه قبل ثبت شده و خطای جدیدی پس از آن ثبت نشده است. فاصله مؤثر Cron: ${cronIntervalMinutes} دقیقه.` };
    }
  } catch (error) {
    checks.cron = { status: "error", label: "خطا", detail: error instanceof Error ? error.message : String(error) };
  }

  const overall = Object.values(checks).some(c => c.status === "error") ? "error" : Object.values(checks).some(c => c.status === "warn" || c.status === "unknown") ? "warn" : "ok";
  return json({ success: true, checkedAt, overall, checks, schedule: `هر ${cronIntervalMinutes} دقیقه` });
}

function readCookie(header, name) { for (const item of String(header || "").split(";")) { const [key, ...rest] = item.trim().split("="); if (key === name) return rest.join("="); } return null; }
async function sha256(value) { const bytes = new TextEncoder().encode(String(value)); const digest = await crypto.subtle.digest("SHA-256", bytes); return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join(""); }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=UTF-8" } }); }
