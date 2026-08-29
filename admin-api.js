export async function handleAdminApi(request, env) {
  const admin = await requireAdminSession(request, env);
  if (!admin) return json({ success: false, error: "احراز هویت لازم است." }, 401);

  const url = new URL(request.url);
  const path = url.pathname;

  if (!env.DB) return json({ success: false, error: "Database is not configured." }, 500);

  try {
    if (request.method === "GET" && path === "/api/admin/sms/overview") {
      return smsOverview(env.DB);
    }

    if (request.method === "GET" && path === "/api/admin/sms/providers") {
      return listProviders(env.DB);
    }

    if (request.method === "POST" && path === "/api/admin/sms/providers") {
      return updateProvider(request, env.DB);
    }

    if (request.method === "GET" && path === "/api/admin/sms/templates") {
      return listTemplates(env.DB);
    }

    if (request.method === "POST" && path === "/api/admin/sms/templates") {
      return updateTemplate(request, env.DB);
    }

    if (request.method === "GET" && path === "/api/admin/sms/logs") {
      return listLogs(request, env.DB);
    }

    return json({ success: false, error: "Not Found" }, 404);
  } catch (error) {
    console.error("Admin SMS API error:", error);
    return json({ success: false, error: error instanceof Error ? error.message : "خطای ناشناخته" }, 500);
  }
}

async function requireAdminSession(request, env) {
  const token = readCookie(request.headers.get("Cookie"), "payamake_session");
  if (!token) return null;

  const tokenHash = await sha256(decodeURIComponent(token));
  const session = await env.DB.prepare(`
    SELECT s.admin_id, a.full_name, a.email, a.is_active
    FROM admin_sessions s
    JOIN admins a ON a.id = s.admin_id
    WHERE s.token_hash = ?
      AND s.revoked_at IS NULL
      AND s.expires_at > CURRENT_TIMESTAMP
      AND a.is_active = 1
    LIMIT 1
  `).bind(tokenHash).first();

  return session || null;
}

async function smsOverview(db) {
  const [providers, totals, recent] = await Promise.all([
    db.prepare(`SELECT id, provider_key, name, sender_number, is_enabled, is_default, created_at, updated_at FROM sms_providers ORDER BY is_default DESC, id ASC`).all(),
    db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN send_status = 'sent' THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN send_status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN delivery_status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN delivery_status = 'pending' THEN 1 ELSE 0 END) AS delivery_pending
      FROM sms_logs
    `).first(),
    db.prepare(`
      SELECT l.id, l.lead_id, l.purpose, l.recipient, l.sender, l.template_id,
             l.send_status, l.delivery_status, l.provider_message_id,
             l.provider_code, l.provider_status, l.error_message,
             l.created_at, l.sent_at, l.delivered_at,
             p.provider_key, p.name AS provider_name
      FROM sms_logs l
      JOIN sms_providers p ON p.id = l.provider_id
      ORDER BY l.id DESC
      LIMIT 8
    `).all(),
  ]);

  return json({
    success: true,
    providers: providers.results || [],
    totals: totals || { total: 0, sent: 0, failed: 0, delivered: 0, delivery_pending: 0 },
    recent: recent.results || [],
  });
}

async function listProviders(db) {
  const result = await db.prepare(`
    SELECT id, provider_key, name, sender_number, is_enabled, is_default, created_at, updated_at
    FROM sms_providers ORDER BY is_default DESC, id ASC
  `).all();
  return json({ success: true, providers: result.results || [] });
}

async function updateProvider(request, db) {
  const body = await readJson(request);
  const id = Number(body?.id);
  if (!id) return json({ success: false, error: "Provider معتبر نیست." }, 400);

  const provider = await db.prepare(`SELECT * FROM sms_providers WHERE id = ?`).bind(id).first();
  if (!provider) return json({ success: false, error: "Provider پیدا نشد." }, 404);

  if (body.senderNumber !== undefined) {
    await db.prepare(`UPDATE sms_providers SET sender_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(String(body.senderNumber || "").trim() || null, id).run();
  }

  if (body.enabled !== undefined) {
    await db.prepare(`UPDATE sms_providers SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(body.enabled ? 1 : 0, id).run();
  }

  if (body.isDefault === true) {
    await db.prepare(`UPDATE sms_providers SET is_default = 0, updated_at = CURRENT_TIMESTAMP`).run();
    await db.prepare(`UPDATE sms_providers SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run();
  }

  const updated = await db.prepare(`SELECT id, provider_key, name, sender_number, is_enabled, is_default, updated_at FROM sms_providers WHERE id = ?`).bind(id).first();
  return json({ success: true, provider: updated });
}

async function listTemplates(db) {
  const result = await db.prepare(`
    SELECT t.id, t.provider_id, p.provider_key, p.name AS provider_name,
           t.purpose, t.template_ref, t.name, t.message_text, t.variables_json,
           t.is_enabled, t.is_default, t.created_at, t.updated_at
    FROM sms_templates t
    JOIN sms_providers p ON p.id = t.provider_id
    ORDER BY p.is_default DESC, p.id ASC, t.purpose ASC, t.id ASC
  `).all();
  return json({ success: true, templates: result.results || [] });
}

async function updateTemplate(request, db) {
  const body = await readJson(request);
  const id = Number(body?.id);
  if (!id) return json({ success: false, error: "Template معتبر نیست." }, 400);

  const template = await db.prepare(`SELECT id FROM sms_templates WHERE id = ?`).bind(id).first();
  if (!template) return json({ success: false, error: "Template پیدا نشد." }, 404);

  const fields = [];
  const values = [];
  if (body.templateRef !== undefined) { fields.push("template_ref = ?"); values.push(String(body.templateRef || "").trim() || null); }
  if (body.messageText !== undefined) { fields.push("message_text = ?"); values.push(String(body.messageText || "")); }
  if (body.variablesJson !== undefined) { fields.push("variables_json = ?"); values.push(String(body.variablesJson || "[]")); }
  if (body.enabled !== undefined) { fields.push("is_enabled = ?"); values.push(body.enabled ? 1 : 0); }
  if (!fields.length) return json({ success: false, error: "تغییری ارسال نشده است." }, 400);

  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);
  await db.prepare(`UPDATE sms_templates SET ${fields.join(", ")} WHERE id = ?`).bind(...values).run();
  const updated = await db.prepare(`SELECT * FROM sms_templates WHERE id = ?`).bind(id).first();
  return json({ success: true, template: updated });
}

async function listLogs(request, db) {
  const url = new URL(request.url);
  const provider = String(url.searchParams.get("provider") || "").trim();
  const status = String(url.searchParams.get("status") || "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);
  const conditions = [];
  const values = [];
  if (provider) { conditions.push("p.provider_key = ?"); values.push(provider); }
  if (status) { conditions.push("(l.send_status = ? OR l.delivery_status = ?)"); values.push(status, status); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await db.prepare(`
    SELECT l.id, l.lead_id, l.purpose, l.recipient, l.sender, l.template_id, l.message,
           l.send_status, l.delivery_status, l.provider_message_id, l.provider_code,
           l.provider_status, l.provider_response, l.error_message,
           l.created_at, l.sent_at, l.delivered_at,
           p.provider_key, p.name AS provider_name
    FROM sms_logs l JOIN sms_providers p ON p.id = l.provider_id
    ${where}
    ORDER BY l.id DESC LIMIT ${limit}
  `).bind(...values).all();

  return json({ success: true, logs: result.results || [] });
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

function readCookie(header, name) {
  const cookies = String(header || "").split(";");
  for (const item of cookies) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8" },
  });
}
