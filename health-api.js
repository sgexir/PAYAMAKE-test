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

  try {
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS system_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT NOT NULL DEFAULT 'info', source TEXT NOT NULL, event TEXT, message TEXT, details_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
    const row = await env.DB.prepare("SELECT level, message, created_at FROM system_logs WHERE source = 'sms_delivery_cron' ORDER BY id DESC LIMIT 1").first();
    if (row) {
      const ageMinutes = Math.max(0, (Date.now() - Date.parse(String(row.created_at).replace(" ", "T") + "Z")) / 60000);
      const stale = ageMinutes > 15;
      checks.cron = {
        status: row.level === "error" || stale ? (row.level === "error" ? "error" : "warn") : "ok",
        label: row.level === "error" ? "خطا" : stale ? "قدیمی" : "فعال",
        detail: `${row.message || "رخداد Cron"} — آخرین رخداد ${Math.round(ageMinutes)} دقیقه قبل.`
      };
    } else {
      checks.cron = { status: "unknown", label: "بدون رخداد", detail: "Cron هر ۵ دقیقه پیکربندی شده، اما هنوز رخداد sms_delivery_cron در System Logs ثبت نشده است. برای مشاهده اجرای موفق، ثبت Cron موفق را فعال کنید." };
    }
  } catch (error) {
    checks.cron = { status: "error", label: "خطا", detail: error instanceof Error ? error.message : String(error) };
  }

  const overall = Object.values(checks).some(c => c.status === "error") ? "error" : Object.values(checks).some(c => c.status === "warn" || c.status === "unknown") ? "warn" : "ok";
  return json({ success: true, checkedAt, overall, checks, schedule: "*/5 * * * *" });
}

function readCookie(header, name) { for (const item of String(header || "").split(";")) { const [key, ...rest] = item.trim().split("="); if (key === name) return rest.join("="); } return null; }
async function sha256(value) { const bytes = new TextEncoder().encode(String(value)); const digest = await crypto.subtle.digest("SHA-256", bytes); return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join(""); }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=UTF-8" } }); }
