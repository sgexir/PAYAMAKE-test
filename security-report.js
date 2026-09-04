export async function handleSecurityReport(request, env) {
  if (!env.DB) return json({ success: false, error: "Database is not configured." }, 500);
  const token = readCookie(request.headers.get("Cookie"), "payamake_session");
  if (!token) return json({ success: false, error: "احراز هویت لازم است." }, 401);
  const hash = await sha256(decodeURIComponent(token));
  const actor = await env.DB.prepare("SELECT s.admin_id,s.ip_address FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND a.is_active=1 LIMIT 1").bind(hash).first();
  if (!actor) return json({ success: false, error: "احراز هویت لازم است." }, 401);
  const url = new URL(request.url); const limit = Math.min(Math.max(Number(url.searchParams.get("limit")||100),1),200);
  const rows = await env.DB.prepare(`SELECT l.id,l.action,l.ip_address,l.details_json,l.created_at,a.username AS actor_username,t.username AS target_username FROM security_audit_log l LEFT JOIN admins a ON a.id=l.admin_id LEFT JOIN admins t ON t.id=l.target_admin_id ORDER BY l.id DESC LIMIT ?`).bind(limit).all();
  return json({ success: true, audit: rows.results || [] });
}
async function sha256(value){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(value)));return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,"0")).join("");}
function readCookie(header,name){const m=String(header||"").match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));return m?m[1]:null;}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=UTF-8","Cache-Control":"no-store"}});}
