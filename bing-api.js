const BING_AUTHORIZE_URL = "https://www.bing.com/webmasters/OAuth/authorize";
const BING_TOKEN_URL = "https://www.bing.com/webmasters/oauth/token";
const REDIRECT_PATH = "/api/admin/analytics/bing/callback";
const STATE_TTL_SECONDS = 10 * 60;

export async function handleBingApi(request, env) {
  if (!env.DB) return json({ success: false, error: "Database is not configured." }, 500);
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "GET" && path === "/api/admin/analytics/bing/callback") {
    return oauthCallback(request, env, url);
  }

  const admin = await requireAdminSession(request, env);
  if (!admin) return json({ success: false, error: "احراز هویت لازم است." }, 401);

  if (request.method === "GET" && path === "/api/admin/analytics/bing/connect") {
    return startOAuth(request, env, admin);
  }
  if (request.method === "GET" && path === "/api/admin/analytics/bing/status") {
    return connectionStatus(env, admin.admin_id);
  }
  if (request.method === "POST" && path === "/api/admin/analytics/bing/disconnect") {
    await env.DB.prepare("DELETE FROM bing_webmaster_connections WHERE admin_id = ?").bind(admin.admin_id).run();
    return json({ success: true, connected: false });
  }

  return json({ success: false, error: "Not Found" }, 404);
}

async function startOAuth(request, env, admin) {
  const clientId = String(env.BING_WEBMASTER_CLIENT_ID || "").trim();
  if (!clientId) return json({ success: false, error: "BING_WEBMASTER_CLIENT_ID تنظیم نشده است." }, 500);

  const state = crypto.randomUUID();
  const stateHash = await sha256(state);
  const expiresAt = new Date(Date.now() + STATE_TTL_SECONDS * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO bing_webmaster_oauth_states (state_hash, admin_id, expires_at)
     VALUES (?, ?, ?)`
  ).bind(stateHash, admin.admin_id, expiresAt).run();

  const redirectUri = getRedirectUri(request);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "webmaster.read",
    state,
  });

  return Response.redirect(`${BING_AUTHORIZE_URL}?${params.toString()}`, 302);
}

async function oauthCallback(request, env, url) {
  const state = String(url.searchParams.get("state") || "").trim();
  const code = String(url.searchParams.get("code") || "").trim();
  const error = String(url.searchParams.get("error") || "").trim();
  const redirectUri = getRedirectUri(request);
  const appUrl = getAppRedirectBase(request);

  if (!state) return Response.redirect(`${appUrl}/admin/?bing=error&reason=missing_state`, 302);

  const stateHash = await sha256(state);
  const stateRow = await env.DB.prepare(
    `SELECT state_hash, admin_id, expires_at
     FROM bing_webmaster_oauth_states
     WHERE state_hash = ? AND expires_at > CURRENT_TIMESTAMP
     LIMIT 1`
  ).bind(stateHash).first();

  await env.DB.prepare("DELETE FROM bing_webmaster_oauth_states WHERE state_hash = ?").bind(stateHash).run();

  if (!stateRow) return Response.redirect(`${appUrl}/admin/?bing=error&reason=invalid_state`, 302);
  if (error || !code) return Response.redirect(`${appUrl}/admin/?bing=denied`, 302);

  const clientId = String(env.BING_WEBMASTER_CLIENT_ID || "").trim();
  const clientSecret = String(env.BING_WEBMASTER_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) return Response.redirect(`${appUrl}/admin/?bing=error&reason=missing_credentials`, 302);

  try {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const response = await fetch(BING_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.access_token || !data?.refresh_token) {
      console.error("Bing OAuth token exchange failed", { status: response.status, data });
      return Response.redirect(`${appUrl}/admin/?bing=error&reason=token_exchange`, 302);
    }

    const accessEncrypted = await encryptToken(env.AUTH_ENCRYPTION_KEY, String(data.access_token));
    const refreshEncrypted = await encryptToken(env.AUTH_ENCRYPTION_KEY, String(data.refresh_token));
    const expiresIn = Math.max(Number(data.expires_in) || 3600, 60);
    const accessExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    await env.DB.prepare(
      `INSERT INTO bing_webmaster_connections
        (admin_id, access_token_encrypted, refresh_token_encrypted, access_expires_at, scope)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(admin_id) DO UPDATE SET
         access_token_encrypted = excluded.access_token_encrypted,
         refresh_token_encrypted = excluded.refresh_token_encrypted,
         access_expires_at = excluded.access_expires_at,
         scope = excluded.scope,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(stateRow.admin_id, accessEncrypted, refreshEncrypted, accessExpiresAt, "webmaster.read").run();

    return Response.redirect(`${appUrl}/admin/?bing=connected`, 302);
  } catch (err) {
    console.error("Bing OAuth callback failed", err);
    return Response.redirect(`${appUrl}/admin/?bing=error&reason=callback`, 302);
  }
}

async function connectionStatus(env, adminId) {
  const row = await env.DB.prepare(
    `SELECT access_expires_at, scope, connected_at, updated_at
     FROM bing_webmaster_connections
     WHERE admin_id = ? LIMIT 1`
  ).bind(adminId).first();
  return json({
    success: true,
    connected: Boolean(row),
    accessExpiresAt: row?.access_expires_at || null,
    scope: row?.scope || null,
    connectedAt: row?.connected_at || null,
    updatedAt: row?.updated_at || null,
  });
}

async function requireAdminSession(request, env) {
  const token = readCookie(request.headers.get("Cookie"), "payamake_session");
  if (!token) return null;
  const tokenHash = await sha256(decodeURIComponent(token));
  return await env.DB.prepare(
    `SELECT s.admin_id, a.full_name, a.email, a.is_active
     FROM admin_sessions s
     JOIN admins a ON a.id = s.admin_id
     WHERE s.token_hash = ?
       AND s.revoked_at IS NULL
       AND s.expires_at > CURRENT_TIMESTAMP
       AND a.is_active = 1
     LIMIT 1`
  ).bind(tokenHash).first();
}

function getRedirectUri(request) {
  const url = new URL(request.url);
  return `${url.origin}${REDIRECT_PATH}`;
}

function getAppRedirectBase(request) {
  const origin = request.headers.get("Origin");
  return origin === "https://staging.payamake.ir" ? origin : "https://staging.payamake.ir";
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
  const data = new TextEncoder().encode(String(value));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hash));
}

async function deriveKey(secret) {
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(secret || "")));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptToken(secret, value) {
  if (!secret) throw new Error("AUTH_ENCRYPTION_KEY تنظیم نشده است.");
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return `${bytesToHex(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

function bytesToHex(bytes) { return [...bytes].map(b => b.toString(16).padStart(2, "0")).join(""); }
function bytesToBase64(bytes) { let binary = ""; for (const b of bytes) binary += String.fromCharCode(b); return btoa(binary); }

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" },
  });
}
