const DEFAULTS = {
  delivery_monitoring_enabled: "1",
  system_error_logging_enabled: "1",
  log_successful_crons: "0",
  duplicate_error_suppression_enabled: "1",
  error_cooldown_minutes: "30",
  cron_interval_minutes: "5"
};

const monitoringSettingsInit = new WeakMap();

export async function handleMonitoringApi(request, env) {
  if (!env.DB) return json({ success: false, error: "Database is not configured." }, 500);
  await ensureMonitoringSettings(env.DB);
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/admin/system/settings") return json({ success: true, settings: await readSettings(env.DB) });
  if (request.method === "POST" && url.pathname === "/api/admin/system/settings") {
    const body = await readJson(request);
    const allowed = new Set(Object.keys(DEFAULTS));
    for (const [key, rawValue] of Object.entries(body || {})) {
      if (!allowed.has(key)) continue;
      let value = String(rawValue);
      if (["delivery_monitoring_enabled", "system_error_logging_enabled", "log_successful_crons", "duplicate_error_suppression_enabled"].includes(key)) value = value === "1" || value === "true" ? "1" : "0";
      if (key === "error_cooldown_minutes") value = String(Math.min(Math.max(Number(rawValue) || 30, 1), 1440));
      if (key === "cron_interval_minutes") value = String(Math.min(Math.max(Number(rawValue) || 5, 1), 1440));
      await env.DB.prepare("INSERT INTO system_settings (setting_key, setting_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP").bind(key, value).run();
    }
    return json({ success: true, settings: await readSettings(env.DB) });
  }
  return json({ success: false, error: "Not Found" }, 404);
}

export async function getMonitoringSetting(db, key) {
  const row = await db.prepare("SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1").bind(key).first();
  return row?.setting_value ?? DEFAULTS[key];
}

export async function shouldLogSystemError(db, source, message) {
  if ((await getMonitoringSetting(db, "system_error_logging_enabled")) !== "1") return false;
  if ((await getMonitoringSetting(db, "duplicate_error_suppression_enabled")) !== "1") return true;
  const cooldown = Number(await getMonitoringSetting(db, "error_cooldown_minutes")) || 30;
  const row = await db.prepare("SELECT created_at FROM system_logs WHERE source = ? AND message = ? AND level IN ('error','warn') ORDER BY id DESC LIMIT 1").bind(source, message).first();
  if (!row?.created_at) return true;
  const ageSeconds = (Date.now() - Date.parse(String(row.created_at).replace(" ", "T") + "Z")) / 1000;
  return !Number.isFinite(ageSeconds) || ageSeconds >= cooldown * 60;
}

export async function writeMonitoringError(db, level, source, message, details = null) {
  if (!db || !(await shouldLogSystemError(db, source, message))) return false;
  await db.prepare("INSERT INTO system_logs (level, source, event, message, details_json) VALUES (?, ?, ?, ?, ?)").bind(level, source, source, message, details == null ? null : JSON.stringify(details)).run();
  return true;
}

export async function ensureMonitoringSettings(db) {
  if (!db) return;
  const existing = monitoringSettingsInit.get(db);
  if (existing) return existing;

  const initialization = (async () => {
    const entries = Object.entries(DEFAULTS);
    const placeholders = entries.map(() => "(?, ?)").join(", ");
    const bindings = entries.flatMap(([key, value]) => [key, value]);
    await db.prepare(`INSERT OR IGNORE INTO system_settings (setting_key, setting_value) VALUES ${placeholders}`).bind(...bindings).run();
  })();

  monitoringSettingsInit.set(db, initialization);
  try {
    await initialization;
  } catch (error) {
    monitoringSettingsInit.delete(db);
    throw error;
  }
}

async function readSettings(db) { const result = await db.prepare("SELECT setting_key, setting_value, updated_at FROM system_settings ORDER BY setting_key").all(); const settings = { ...DEFAULTS }; for (const row of result.results || []) settings[row.setting_key] = row.setting_value; return settings; }
async function readJson(request) { try { return await request.json(); } catch { return null; } }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=UTF-8" } }); }
