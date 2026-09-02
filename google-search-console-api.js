const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SEARCH_CONSOLE_URL = "https://searchconsole.googleapis.com/webmasters/v3/sites";
const REDIRECT_PATH = "/api/admin/analytics/google/callback";
const SITE_URL = "https://payamake.ir/";
const DOMAIN_SITE_URL = "sc-domain:payamake.ir";

export async function handleGoogleSearchConsoleApi(request, env) {
  if (!env.DB) return json({ success: false, error: "Database is not configured." }, 500);
  await ensureTables(env.DB);
  const url = new URL(request.url), path = url.pathname;
  if (request.method === "GET" && path === REDIRECT_PATH) return oauthCallback(request, env, url);
  const admin = await requireAdminSession(request, env);
  if (!admin) return json({ success: false, error: "احراز هویت لازم است." }, 401);
  if (request.method === "GET" && path === "/api/admin/analytics/google/connect") return startOAuth(request, env, admin);
  if (request.method === "GET" && path === "/api/admin/analytics/google/status") return status(env, admin.admin_id);
  if (request.method === "GET" && path === "/api/admin/analytics/google/data") return analyticsData(request, env, admin.admin_id);
  if (request.method === "POST" && path === "/api/admin/analytics/google/disconnect") {
    await env.DB.prepare("DELETE FROM google_search_console_connections WHERE admin_id=?").bind(admin.admin_id).run();
    return json({ success: true, connected: false });
  }
  return json({ success: false, error: "Not Found" }, 404);
}

async function startOAuth(request, env, admin) {
  const clientId = String(env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID || "").trim();
  if (!clientId) return json({ success: false, error: "GOOGLE_SEARCH_CONSOLE_CLIENT_ID تنظیم نشده است." }, 500);
  const state = crypto.randomUUID();
  const stateHash = await sha256(state);
  await env.DB.prepare("INSERT INTO google_search_console_oauth_states(state_hash,admin_id,expires_at) VALUES(?,?,datetime('now','+10 minutes'))").bind(stateHash, admin.admin_id).run();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(request),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    state
  });
  return Response.redirect(`${GOOGLE_AUTHORIZE_URL}?${params}`, 302);
}

async function oauthCallback(request, env, url) {
  const state = String(url.searchParams.get("state") || "").trim();
  const code = String(url.searchParams.get("code") || "").trim();
  const error = String(url.searchParams.get("error") || "").trim();
  const base = "https://staging.payamake.ir";
  if (!state) return Response.redirect(`${base}/admin/?google=error&reason=missing_state`, 302);
  const stateHash = await sha256(state);
  const row = await env.DB.prepare("SELECT state_hash,admin_id FROM google_search_console_oauth_states WHERE state_hash=? AND expires_at>CURRENT_TIMESTAMP LIMIT 1").bind(stateHash).first();
  await env.DB.prepare("DELETE FROM google_search_console_oauth_states WHERE state_hash=?").bind(stateHash).run();
  if (!row) return Response.redirect(`${base}/admin/?google=error&reason=invalid_state`, 302);
  if (error || !code) return Response.redirect(`${base}/admin/?google=denied`, 302);
  const clientId = String(env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID || "").trim();
  const clientSecret = String(env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) return Response.redirect(`${base}/admin/?google=error&reason=missing_credentials`, 302);
  try {
    const body = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: getRedirectUri(request), grant_type: "authorization_code" });
    const response = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.access_token) throw new Error(data?.error_description || `Google token exchange failed (${response.status})`);
    const accessEncrypted = await encryptToken(env.AUTH_ENCRYPTION_KEY, String(data.access_token));
    const refreshEncrypted = data.refresh_token ? await encryptToken(env.AUTH_ENCRYPTION_KEY, String(data.refresh_token)) : null;
    const expiresAt = new Date(Date.now() + Math.max(Number(data.expires_in) || 3600, 60) * 1000).toISOString();
    const existing = await env.DB.prepare("SELECT refresh_token_encrypted FROM google_search_console_connections WHERE admin_id=?").bind(row.admin_id).first();
    await env.DB.prepare(`INSERT INTO google_search_console_connections(admin_id,access_token_encrypted,refresh_token_encrypted,access_expires_at,site_url,scope) VALUES(?,?,?,?,?,?) ON CONFLICT(admin_id) DO UPDATE SET access_token_encrypted=excluded.access_token_encrypted,refresh_token_encrypted=COALESCE(excluded.refresh_token_encrypted,google_search_console_connections.refresh_token_encrypted),access_expires_at=excluded.access_expires_at,site_url=excluded.site_url,scope=excluded.scope,updated_at=CURRENT_TIMESTAMP`).bind(row.admin_id, accessEncrypted, refreshEncrypted || existing?.refresh_token_encrypted || "", expiresAt, SITE_URL, "https://www.googleapis.com/auth/webmasters.readonly").run();
    return Response.redirect(`${base}/admin/?google=connected`, 302);
  } catch (e) {
    console.error("Google Search Console OAuth callback failed", e);
    return Response.redirect(`${base}/admin/?google=error&reason=callback`, 302);
  }
}

async function status(env, adminId) {
  const row = await env.DB.prepare("SELECT site_url,scope,connected_at,updated_at FROM google_search_console_connections WHERE admin_id=? LIMIT 1").bind(adminId).first();
  return json({ success: true, connected: Boolean(row), siteUrl: row?.site_url || SITE_URL, scope: row?.scope || null, connectedAt: row?.connected_at || null, updatedAt: row?.updated_at || null });
}

async function analyticsData(request, env, adminId) {
  try {
    const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get("days")) || 30, 1), 90);
    const token = await getAccessToken(env, adminId);
    if (!token) return json({ success: false, error: "Google Search Console متصل نیست." }, 400);
    const siteUrl = await resolveSiteUrl(token, env, adminId);
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - 1);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const startDate = start.toISOString().slice(0, 10), endDate = end.toISOString().slice(0, 10);
    const [summaryRows, queries, pages, countries, devices] = await Promise.all([
      querySearchConsole(token, siteUrl, { startDate, endDate, dimensions: ["date"], rowLimit: 25000 }),
      querySearchConsole(token, siteUrl, { startDate, endDate, dimensions: ["query"], rowLimit: 50 }),
      querySearchConsole(token, siteUrl, { startDate, endDate, dimensions: ["page"], rowLimit: 50 }),
      querySearchConsole(token, siteUrl, { startDate, endDate, dimensions: ["country"], rowLimit: 30 }),
      querySearchConsole(token, siteUrl, { startDate, endDate, dimensions: ["device"], rowLimit: 10 })
    ]);
    const sum = rows => rows.reduce((a, r) => ({ clicks: a.clicks + Number(r.clicks || 0), impressions: a.impressions + Number(r.impressions || 0), weightedPosition: a.weightedPosition + Number(r.position || 0) * Number(r.impressions || 0) }), { clicks: 0, impressions: 0, weightedPosition: 0 });
    const totals = sum(summaryRows);
    const mapRows = (rows, key) => rows.map(r => ({ [key]: r.keys?.[0] || "—", clicks: Number(r.clicks || 0), impressions: Number(r.impressions || 0), ctr: Number(r.ctr || 0) * 100, position: Number(r.position || 0) })).sort((a,b) => b.clicks - a.clicks);
    return json({ success: true, siteUrl, startDate, endDate, days, summary: { clicks: totals.clicks, impressions: totals.impressions, ctr: totals.impressions ? totals.clicks / totals.impressions * 100 : 0, position: totals.impressions ? totals.weightedPosition / totals.impressions : 0 }, series: summaryRows.map(r => ({ date: r.keys?.[0], clicks: Number(r.clicks || 0), impressions: Number(r.impressions || 0), ctr: Number(r.ctr || 0) * 100, position: Number(r.position || 0) })), queries: mapRows(queries, "query"), pages: mapRows(pages, "page"), countries: mapRows(countries, "country"), devices: mapRows(devices, "device") });
  } catch (e) {
    console.error("Google Search Console analytics failed", e);
    return json({ success: false, error: e.message || "دریافت آمار Google Search Console انجام نشد." }, 502);
  }
}

async function resolveSiteUrl(token, env, adminId) {
  const r = await fetch(GOOGLE_SEARCH_CONSOLE_URL, { headers: { Authorization: `Bearer ${token}` } });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error?.message || `Google Search Console sites API error (${r.status})`);
  const sites = Array.isArray(data?.siteEntry) ? data.siteEntry : [];
  const exactDomain = sites.find(site => site.siteUrl === DOMAIN_SITE_URL);
  const exactUrl = sites.find(site => site.siteUrl === SITE_URL);
  const alternateUrl = sites.find(site => site.siteUrl === "https://payamake.ir");
  const match = exactDomain || exactUrl || alternateUrl;
  if (!match) {
    const relevant = sites.filter(site => /payamake\.ir/i.test(String(site.siteUrl || ""))).map(site => `${site.siteUrl} (${site.permissionLevel || "unknown"})`);
    const details = relevant.length ? ` موارد قابل دسترسی: ${relevant.join(", ")}` : " هیچ Property مطابق payamake.ir از طریق API قابل دسترسی نیست.";
    throw new Error(`حساب Google متصل است، اما Property مناسب Google Search Console پیدا نشد.${details}`);
  }
  if (match.permissionLevel === "siteUnverifiedUser") {
    throw new Error(`Property ${match.siteUrl} در Google Search Console برای حساب متصل فقط سطح دسترسی siteUnverifiedUser دارد و برای دریافت داده کافی نیست.`);
  }
  if (match.siteUrl !== SITE_URL) {
    await env.DB.prepare("UPDATE google_search_console_connections SET site_url=?,updated_at=CURRENT_TIMESTAMP WHERE admin_id=?").bind(match.siteUrl, adminId).run();
  }
  return match.siteUrl;
}

async function querySearchConsole(token, siteUrl, body) {
  const encoded = encodeURIComponent(siteUrl);
  const r = await fetch(`${GOOGLE_SEARCH_CONSOLE_URL}/${encoded}/searchAnalytics/query`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error(data?.error?.message || `Google Search Console API error (${r.status})`);
  return Array.isArray(data?.rows) ? data.rows : [];
}

async function getAccessToken(env, adminId) {
  const row = await env.DB.prepare("SELECT access_token_encrypted,refresh_token_encrypted,access_expires_at FROM google_search_console_connections WHERE admin_id=? LIMIT 1").bind(adminId).first();
  if (!row) return null;
  if (row.access_expires_at && Date.parse(row.access_expires_at) > Date.now() + 60000) return decryptToken(env.AUTH_ENCRYPTION_KEY, row.access_token_encrypted);
  const refresh = await decryptToken(env.AUTH_ENCRYPTION_KEY, row.refresh_token_encrypted);
  if (!refresh) return null;
  const body = new URLSearchParams({ client_id: String(env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID || ""), client_secret: String(env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET || ""), refresh_token: refresh, grant_type: "refresh_token" });
  const r = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const data = await r.json().catch(() => null);
  if (!r.ok || !data?.access_token) throw new Error(data?.error_description || `Google token refresh failed (${r.status})`);
  const encrypted = await encryptToken(env.AUTH_ENCRYPTION_KEY, String(data.access_token));
  const expiresAt = new Date(Date.now() + Math.max(Number(data.expires_in) || 3600, 60) * 1000).toISOString();
  await env.DB.prepare("UPDATE google_search_console_connections SET access_token_encrypted=?,access_expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE admin_id=?").bind(encrypted, expiresAt, adminId).run();
  return String(data.access_token);
}

async function ensureTables(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS google_search_console_oauth_states (state_hash TEXT PRIMARY KEY, admin_id INTEGER NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS google_search_console_connections (admin_id INTEGER PRIMARY KEY, access_token_encrypted TEXT NOT NULL, refresh_token_encrypted TEXT, access_expires_at TEXT, site_url TEXT NOT NULL DEFAULT 'https://payamake.ir/', scope TEXT, connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
}

function getRedirectUri(request) { return `${new URL(request.url).origin}${REDIRECT_PATH}`; }
async function requireAdminSession(request, env) { const token = readCookie(request.headers.get("Cookie"), "payamake_session"); if (!token) return null; const tokenHash = await sha256(decodeURIComponent(token)); return env.DB.prepare(`SELECT s.admin_id,a.full_name,a.email,a.is_active FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND a.is_active=1 LIMIT 1`).bind(tokenHash).first(); }
function readCookie(header, name) { for (const item of String(header || "").split(";")) { const [key, ...rest] = item.trim().split("="); if (key === name) return rest.join("="); } return null; }
async function sha256(value) { const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value))); return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join(""); }
async function deriveKey(secret) { const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(secret || ""))); return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]); }
async function encryptToken(secret, value) { if (!secret) throw new Error("AUTH_ENCRYPTION_KEY تنظیم نشده است."); const key = await deriveKey(secret), iv = crypto.getRandomValues(new Uint8Array(12)), encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value)); return `${[...iv].map(b => b.toString(16).padStart(2, "0")).join("")}.${bytesToBase64(new Uint8Array(encrypted))}`; }
async function decryptToken(secret, payload) { if (!secret || !payload) return null; try { const [ivHex, cipherText] = String(payload).split("."); const key = await deriveKey(secret), iv = new Uint8Array(ivHex.match(/.{2}/g).map(x => parseInt(x, 16))), binary = atob(cipherText), cipher = new Uint8Array([...binary].map(c => c.charCodeAt(0))); const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher); return new TextDecoder().decode(plain); } catch { return null; } }
function bytesToBase64(bytes) { let binary = ""; for (const b of bytes) binary += String.fromCharCode(b); return btoa(binary); }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" } }); }
