export async function handleLeadsApi(request, env) {
  const admin = await requireAdminSession(request, env);
  if (!admin) return json({ success: false, error: "احراز هویت لازم است." }, 401);
  if (!env.DB) return json({ success: false, error: "Database is not configured." }, 500);
  const url = new URL(request.url);
  try {
    if (request.method === "GET" && url.pathname === "/api/admin/leads") return listLeads(request, env.DB);
    if (request.method === "GET" && /^\/api\/admin\/leads\/\d+$/.test(url.pathname)) return getLead(url.pathname.split("/").pop(), env.DB);
    if (request.method === "POST" && /^\/api\/admin\/leads\/\d+$/.test(url.pathname)) return updateLead(request, url.pathname.split("/").pop(), env.DB, admin);
    return json({ success: false, error: "Not Found" }, 404);
  } catch (error) {
    console.error("Leads API error:", error);
    return json({ success: false, error: error instanceof Error ? error.message : "خطای ناشناخته" }, 500);
  }
}

async function listLeads(request, db) {
  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim();
  const status = String(url.searchParams.get("status") || "").trim();
  const pageSize = Math.min(Math.max(Number(url.searchParams.get("pageSize") || 20), 1), 100);
  const page = Math.max(Number(url.searchParams.get("page") || 1), 1);
  const conditions = [], values = [];
  if (status) { conditions.push("lead_status = ?"); values.push(status); }
  if (q) { conditions.push("(full_name LIKE ? OR phone LIKE ? OR brand LIKE ? OR type LIKE ? OR description LIKE ?)"); const x = `%${q}%`; values.push(x,x,x,x,x); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const count = await db.prepare(`SELECT COUNT(*) AS total FROM leads ${where}`).bind(...values).first();
  const total = Number(count?.total || 0);
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const rows = await db.prepare(`SELECT id, full_name, phone, brand, type, description, source, lead_status, admin_notes, customer_sms_status, admin_sms_status, created_at, updated_at FROM leads ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).bind(...values, pageSize, (safePage - 1) * pageSize).all();
  const stats = await db.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN lead_status='new' THEN 1 ELSE 0 END) AS new_count, SUM(CASE WHEN lead_status='in_progress' THEN 1 ELSE 0 END) AS in_progress_count, SUM(CASE WHEN lead_status='done' THEN 1 ELSE 0 END) AS done_count, SUM(CASE WHEN lead_status='rejected' THEN 1 ELSE 0 END) AS rejected_count FROM leads`).first();
  return json({ success: true, leads: rows.results || [], stats: stats || {}, pagination: { page: safePage, pageSize, total, totalPages } });
}

async function getLead(id, db) {
  const lead = await db.prepare(`SELECT id, full_name, phone, brand, type, description, source, lead_status, admin_notes, customer_sms_status, admin_sms_status, created_at, updated_at FROM leads WHERE id = ?`).bind(Number(id)).first();
  if (!lead) return json({ success: false, error: "درخواست پیدا نشد." }, 404);
  const activity = await db.prepare(`SELECT a.id, a.activity_type, a.old_status, a.new_status, a.note, a.created_at, a.admin_id, COALESCE(ad.full_name, 'سیستم') AS admin_name FROM lead_activity a LEFT JOIN admins ad ON ad.id = a.admin_id WHERE a.lead_id = ? ORDER BY a.created_at DESC, a.id DESC`).bind(Number(id)).all();
  return json({ success: true, lead, activity: activity.results || [] });
}

async function updateLead(request, id, db, admin) {
  const leadId = Number(id);
  const body = await readJson(request);
  const allowed = ["new", "in_progress", "done", "rejected"];
  const status = body?.status === undefined ? undefined : String(body.status);
  if (status !== undefined && !allowed.includes(status)) return json({ success: false, error: "وضعیت نامعتبر است." }, 400);
  if (status === undefined && body?.adminNotes === undefined) return json({ success: false, error: "تغییری ارسال نشده است." }, 400);

  const current = await db.prepare(`SELECT lead_status, admin_notes FROM leads WHERE id = ?`).bind(leadId).first();
  if (!current) return json({ success: false, error: "درخواست پیدا نشد." }, 404);

  if (status !== undefined && status !== current.lead_status) {
    await db.prepare(`UPDATE leads SET lead_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(status, leadId).run();
    await db.prepare(`INSERT INTO lead_activity (lead_id, admin_id, activity_type, old_status, new_status) VALUES (?, ?, 'status_changed', ?, ?)`).bind(leadId, admin.admin_id, current.lead_status, status).run();
  }

  if (body?.adminNotes !== undefined) {
    const note = String(body.adminNotes || "").trim() || null;
    if (note !== current.admin_notes) {
      await db.prepare(`UPDATE leads SET admin_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(note, leadId).run();
      await db.prepare(`INSERT INTO lead_activity (lead_id, admin_id, activity_type, note) VALUES (?, ?, 'note_updated', ?)`).bind(leadId, admin.admin_id, note).run();
    }
  }

  return getLead(leadId, db);
}

async function requireAdminSession(request, env) {
  const token = readCookie(request.headers.get("Cookie"), "payamake_session");
  if (!token) return null;
  const tokenHash = await sha256(decodeURIComponent(token));
  return await env.DB.prepare(`SELECT s.admin_id, a.full_name, a.email, a.is_active FROM admin_sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP AND a.is_active = 1 LIMIT 1`).bind(tokenHash).first();
}

function readCookie(header, name) {
  const source = String(header || "");
  for (const part of source.split(";")) { const i = part.indexOf("="); if (i < 0) continue; if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim(); }
  return null;
}

async function sha256(value) { const data = new TextEncoder().encode(value); const hash = await crypto.subtle.digest("SHA-256", data); return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,"0")).join(""); }
async function readJson(request) { try { return await request.json(); } catch { return {}; } }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=UTF-8" } }); }
