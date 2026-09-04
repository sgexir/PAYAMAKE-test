const PASSWORD_ITERATIONS = 100000;
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const PREAUTH_TTL_SECONDS = 5 * 60;
const DUMMY_PASSWORD_HASH = "pbkdf2$sha256$100000$00112233445566778899aabbccddeeff$0000000000000000000000000000000000000000000000000000000000000000";

export async function handleSecurityAuth(request, env) {
  if (!env.DB) return json({ success: false, error: "Database is not configured." }, 500);
  await ensureSecuritySchema(env.DB);
  const path = new URL(request.url).pathname;
  if (request.method === "POST" && path === "/api/admin/login") return login(request, env);
  if (request.method === "GET" && path === "/api/admin/me") return me(request, env);
  if (request.method === "POST" && path === "/api/admin/logout") return logout(request, env);
  return json({ success: false, error: "Not Found" }, 404);
}

export async function handleSecurityApi(request, env) {
  if (!env.DB) return json({ success: false, error: "Database is not configured." }, 500);
  await ensureSecuritySchema(env.DB);
  const actor = await requireSession(request, env.DB);
  if (!actor) return json({ success: false, error: "احراز هویت لازم است." }, 401);
  const path = new URL(request.url).pathname;
  try {
    if (request.method === "GET" && path === "/api/admin/security/sessions") return listSessions(env.DB);
    if (request.method === "POST" && path === "/api/admin/security/sessions/revoke") return revokeSession(request, env.DB, actor);
    if (request.method === "POST" && path === "/api/admin/security/sessions/revoke-all") return revokeAllSessions(request, env.DB, actor);
    if (request.method === "GET" && path === "/api/admin/security/login-activity") return loginActivity(request, env.DB);
    if (request.method === "GET" && path === "/api/admin/security/admins") return listAdmins(env.DB);
    if (request.method === "POST" && path === "/api/admin/security/admins") return createAdmin(request, env.DB, actor);
    if (request.method === "POST" && path === "/api/admin/security/admins/action") return adminAction(request, env.DB, actor);
    if (request.method === "GET" && path === "/api/admin/security/ip-blocklist") return listIpBlocks(env.DB);
    if (request.method === "POST" && path === "/api/admin/security/ip-blocklist") return changeIpBlock(request, env.DB, actor);
    if (request.method === "POST" && path === "/api/admin/security/password") return changeOwnPassword(request, env);
    return json({ success: false, error: "Not Found" }, 404);
  } catch (error) {
    console.error("Security API error:", error);
    await audit(env.DB, actor.admin_id, "security_api_error", null, actor.ip_address, { path, message: error instanceof Error ? error.message : String(error) });
    return json({ success: false, error: "عملیات امنیتی انجام نشد." }, 500);
  }
}

async function ensureSecuritySchema(db) {
  const columns = await db.prepare("PRAGMA table_info(admins)").all();
  if (!(columns.results || []).some((c) => c.name === "username")) {
    await db.prepare("ALTER TABLE admins ADD COLUMN username TEXT").run();
    await db.prepare("UPDATE admins SET username = 'main-admin' WHERE username IS NULL AND id = (SELECT MIN(id) FROM admins)").run();
  }
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS uq_admins_username ON admins(username) WHERE username IS NOT NULL").run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS security_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    action TEXT NOT NULL,
    target_admin_id INTEGER,
    ip_address TEXT,
    details_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(admin_id) REFERENCES admins(id) ON DELETE SET NULL,
    FOREIGN KEY(target_admin_id) REFERENCES admins(id) ON DELETE SET NULL
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_security_audit_created_at ON security_audit_log(created_at)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_security_audit_target ON security_audit_log(target_admin_id)").run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS ip_blocklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL UNIQUE,
    reason TEXT,
    blocked_by INTEGER,
    blocked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unblocked_at TEXT,
    FOREIGN KEY(blocked_by) REFERENCES admins(id) ON DELETE SET NULL
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_ip_blocklist_active ON ip_blocklist(ip_address, unblocked_at)").run();
}

async function login(request, env) {
  const body = await readJson(request);
  if (!body) return json({ success: false, error: "داده ارسالی معتبر نیست." }, 400);
  const username = normalizeUsername(body.username);
  const password = String(body.password || "");
  const ip = getIp(request);
  const userAgent = request.headers.get("User-Agent") || null;
  if (!username || password.length < 1 || password.length > 256) return json({ success: false, error: "نام کاربری و رمز عبور الزامی است." }, 400);
  if (await isIpBlocked(env.DB, ip)) {
    await recordAttempt(env.DB, null, username, ip, userAgent, "locked", false, "ip_blocked");
    return json({ success: false, error: "دسترسی از این IP مسدود شده است." }, 403);
  }
  if (await isRateLimited(env.DB, username, ip)) {
    await recordAttempt(env.DB, null, username, ip, userAgent, "locked", false, "rate_limited");
    return json({ success: false, error: "تعداد تلاش‌های ورود بیش از حد مجاز است. کمی بعد دوباره تلاش کنید." }, 429);
  }
  const admin = await env.DB.prepare("SELECT id, full_name, username, email, password_hash, is_active FROM admins WHERE username = ? COLLATE NOCASE LIMIT 1").bind(username).first();
  const passwordOk = await verifyPassword(password, admin?.password_hash || DUMMY_PASSWORD_HASH);
  if (!admin || !passwordOk) {
    await recordAttempt(env.DB, admin?.id || null, username, ip, userAgent, "password_failed", false, "invalid_credentials");
    return json({ success: false, error: "نام کاربری یا رمز عبور صحیح نیست." }, 401);
  }
  if (!admin.is_active) {
    await recordAttempt(env.DB, admin.id, username, ip, userAgent, "locked", false, "account_inactive");
    return json({ success: false, error: "این حساب غیرفعال است." }, 403);
  }
  await recordAttempt(env.DB, admin.id, username, ip, userAgent, "password_success", true, null);
  const methods = await env.DB.prepare(`SELECT id, method_type, destination_masked, is_primary FROM mfa_methods WHERE admin_id = ? AND is_enabled = 1 AND is_verified = 1 ORDER BY is_primary DESC, id ASC`).bind(admin.id).all();
  const requireMfa = env.AUTH_REQUIRE_MFA !== "false";
  const preauth = await createPreAuthToken(env, admin.id, ip);
  if (requireMfa && !methods.results?.length) {
    await recordAttempt(env.DB, admin.id, username, ip, userAgent, "locked", false, "mfa_not_configured");
    return json({ success: false, error: "برای این حساب احراز هویت دومرحله‌ای هنوز فعال نشده است.", code: "MFA_SETUP_REQUIRED", preauthToken: preauth }, 403);
  }
  if (!methods.results?.length) {
    const session = await createSession(env.DB, admin.id, ip, userAgent);
    await env.DB.prepare("UPDATE admins SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(admin.id).run();
    await audit(env.DB, admin.id, "login_success", admin.id, ip, { method: "password_only" });
    return json({ success: true, authenticated: true, mfaRequired: false, admin: { id: admin.id, username: admin.username, fullName: admin.full_name } }, 200, session.cookie);
  }
  return json({ success: true, authenticated: false, mfaRequired: true, preauthToken: preauth, methods: methods.results.map((m) => ({ id: m.id, type: m.method_type, destination: m.destination_masked, primary: Boolean(m.is_primary) })) });
}

async function me(request, env) {
  const session = await requireSession(request, env.DB);
  if (!session) return json({ success: false, authenticated: false }, 401, clearCookie());
  return json({ success: true, authenticated: true, admin: { id: session.admin_id, username: session.username, fullName: session.full_name, email: session.email, isActive: Boolean(session.is_active) } });
}

async function logout(request, env) {
  const token = readCookie(request.headers.get("Cookie"), "payamake_session");
  if (token) await env.DB.prepare("UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND revoked_at IS NULL").bind(await sha256(decodeURIComponent(token))).run();
  return json({ success: true }, 200, clearCookie());
}

async function listSessions(db) {
  const rows = await db.prepare(`SELECT s.id, s.admin_id, a.username, a.full_name, s.ip_address, s.user_agent, s.expires_at, s.created_at, s.revoked_at FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.expires_at > CURRENT_TIMESTAMP AND s.revoked_at IS NULL ORDER BY s.created_at DESC LIMIT 200`).all();
  return json({ success: true, sessions: rows.results || [] });
}

async function revokeSession(request, db, actor) {
  const body = await readJson(request); const id = String(body?.sessionId || "");
  if (!id) return json({ success: false, error: "Session معتبر نیست." }, 400);
  const row = await db.prepare("SELECT id, admin_id, ip_address FROM admin_sessions WHERE id = ? LIMIT 1").bind(id).first();
  if (!row) return json({ success: false, error: "Session پیدا نشد." }, 404);
  await db.prepare("UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL").bind(id).run();
  await audit(db, actor.admin_id, "session_revoked", row.admin_id, actor.ip_address, { sessionId: id, targetIp: row.ip_address });
  return json({ success: true });
}

async function revokeAllSessions(request, db, actor) {
  const body = await readJson(request); const targetId = Number(body?.adminId);
  if (!targetId) return json({ success: false, error: "حساب معتبر نیست." }, 400);
  const target = await db.prepare("SELECT id, username FROM admins WHERE id = ? LIMIT 1").bind(targetId).first();
  if (!target) return json({ success: false, error: "حساب پیدا نشد." }, 404);
  const result = await db.prepare("UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE admin_id = ? AND revoked_at IS NULL").bind(targetId).run();
  await audit(db, actor.admin_id, "sessions_revoked_all", targetId, actor.ip_address, { count: Number(result.meta?.changes || 0) });
  return json({ success: true, revoked: Number(result.meta?.changes || 0) });
}

async function loginActivity(request, db) {
  const url = new URL(request.url); const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200); const adminId = Number(url.searchParams.get("adminId") || 0);
  const where = adminId ? "WHERE l.admin_id = ?" : ""; const values = adminId ? [adminId, limit] : [limit];
  const rows = await db.prepare(`SELECT l.id, l.admin_id, a.username, l.email AS login_identifier, l.ip_address, l.user_agent, l.stage, l.success, l.failure_reason, l.created_at FROM login_attempts l LEFT JOIN admins a ON a.id=l.admin_id ${where} ORDER BY l.id DESC LIMIT ?`).bind(...values).all();
  return json({ success: true, activity: rows.results || [] });
}

async function listAdmins(db) {
  const rows = await db.prepare(`SELECT a.id, a.full_name, a.username, a.email, a.is_active, a.last_login_at, a.created_at, EXISTS(SELECT 1 FROM mfa_methods m WHERE m.admin_id=a.id AND m.is_enabled=1 AND m.is_verified=1) AS mfa_enabled, (SELECT COUNT(*) FROM admin_sessions s WHERE s.admin_id=a.id AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP) AS active_sessions FROM admins a ORDER BY a.id ASC`).all();
  return json({ success: true, admins: rows.results || [] });
}

async function createAdmin(request, db, actor) {
  const body = await readJson(request); const username = normalizeUsername(body?.username); const password = String(body?.password || ""); const fullName = String(body?.fullName || "").trim(); const email = String(body?.email || "").trim().toLowerCase() || null;
  if (!username || username.length < 6) return json({ success: false, error: "نام کاربری باید حداقل ۶ کاراکتر باشد." }, 400);
  if (!/^[a-zA-Z0-9._-]{6,64}$/.test(username)) return json({ success: false, error: "نام کاربری فقط می‌تواند شامل حروف انگلیسی، عدد، نقطه، خط تیره و زیرخط باشد." }, 400);
  if (password.length < 12 || password.length > 256) return json({ success: false, error: "رمز عبور باید حداقل ۱۲ کاراکتر باشد." }, 400);
  if (!fullName) return json({ success: false, error: "نام مدیر الزامی است." }, 400);
  const exists = await db.prepare("SELECT id FROM admins WHERE username = ? COLLATE NOCASE").bind(username).first(); if (exists) return json({ success: false, error: "این نام کاربری قبلاً استفاده شده است." }, 409);
  const hash = await hashPassword(password);
  const result = await db.prepare("INSERT INTO admins (full_name, username, email, password_hash, is_active) VALUES (?, ?, ?, ?, 1)").bind(fullName, username, email, hash).run();
  const id = Number(result.meta?.last_row_id || 0); await audit(db, actor.admin_id, "admin_created", id, actor.ip_address, { username });
  return json({ success: true, admin: { id, username, fullName, email } });
}

async function adminAction(request, db, actor) {
  const body = await readJson(request); const targetId = Number(body?.adminId); const action = String(body?.action || "");
  const target = await db.prepare("SELECT id, username, is_active FROM admins WHERE id = ? LIMIT 1").bind(targetId).first();
  if (!target) return json({ success: false, error: "حساب پیدا نشد." }, 404);
  if (action === "disable") {
    if (target.id === actor.admin_id) return json({ success: false, error: "نمی‌توانید حساب فعلی خود را غیرفعال کنید." }, 400);
    const count = await db.prepare("SELECT COUNT(*) AS c FROM admins WHERE is_active=1").first(); if (Number(count?.c || 0) <= 1) return json({ success: false, error: "حداقل یک مدیر فعال باید باقی بماند." }, 400);
    await db.prepare("UPDATE admins SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(targetId).run();
    await db.prepare("UPDATE admin_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE admin_id=? AND revoked_at IS NULL").bind(targetId).run();
    await audit(db, actor.admin_id, "admin_disabled", targetId, actor.ip_address, null); return json({ success: true });
  }
  if (action === "enable") { await db.prepare("UPDATE admins SET is_active=1, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(targetId).run(); await audit(db, actor.admin_id, "admin_enabled", targetId, actor.ip_address, null); return json({ success: true }); }
  if (action === "reset_mfa") { await db.prepare("DELETE FROM recovery_codes WHERE admin_id=?").bind(targetId).run(); await db.prepare("DELETE FROM mfa_methods WHERE admin_id=?").bind(targetId).run(); await db.prepare("DELETE FROM otp_challenges WHERE admin_id=?").bind(targetId).run(); await db.prepare("UPDATE admin_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE admin_id=? AND revoked_at IS NULL").bind(targetId).run(); await audit(db, actor.admin_id, "mfa_reset", targetId, actor.ip_address, null); return json({ success: true }); }
  if (action === "reset_recovery") { const codes = await generateRecoveryCodes(db, targetId); await audit(db, actor.admin_id, "recovery_codes_reset", targetId, actor.ip_address, null); return json({ success: true, recoveryCodes: codes }); }
  if (action === "reset_password") { const password = String(body?.password || ""); if (password.length < 12 || password.length > 256) return json({ success: false, error: "رمز عبور باید حداقل ۱۲ کاراکتر باشد." }, 400); await db.prepare("UPDATE admins SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(await hashPassword(password), targetId).run(); await db.prepare("UPDATE admin_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE admin_id=? AND revoked_at IS NULL").bind(targetId).run(); await audit(db, actor.admin_id, "password_reset", targetId, actor.ip_address, null); return json({ success: true }); }
  return json({ success: false, error: "عملیات پشتیبانی نمی‌شود." }, 400);
}

async function changeOwnPassword(request, env) {
  const actor = await requireSession(request, env.DB); if (!actor) return json({ success: false, error: "احراز هویت لازم است." }, 401);
  const body = await readJson(request); const current = String(body?.currentPassword || ""); const next = String(body?.newPassword || "");
  if (next.length < 12 || next.length > 256) return json({ success: false, error: "رمز عبور جدید باید حداقل ۱۲ کاراکتر باشد." }, 400);
  const row = await env.DB.prepare("SELECT password_hash FROM admins WHERE id=?").bind(actor.admin_id).first(); if (!(await verifyPassword(current, row?.password_hash || ""))) return json({ success: false, error: "رمز عبور فعلی صحیح نیست." }, 401);
  await env.DB.prepare("UPDATE admins SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(await hashPassword(next), actor.admin_id).run();
  await env.DB.prepare("UPDATE admin_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE admin_id=? AND id<>? AND revoked_at IS NULL").bind(actor.admin_id, actor.session_id).run();
  await audit(env.DB, actor.admin_id, "password_changed", actor.admin_id, actor.ip_address, null); return json({ success: true });
}

async function listIpBlocks(db) { const rows = await db.prepare(`SELECT b.id,b.ip_address,b.reason,b.blocked_at,b.unblocked_at,a.username AS blocked_by_username FROM ip_blocklist b LEFT JOIN admins a ON a.id=b.blocked_by ORDER BY b.id DESC LIMIT 200`).all(); return json({ success: true, blocks: rows.results || [] }); }

async function changeIpBlock(request, db, actor) {
  const body = await readJson(request); const ip = String(body?.ip || "").trim(); const action = String(body?.action || "block"); const reason = String(body?.reason || "").trim() || null;
  if (!isValidIp(ip)) return json({ success: false, error: "IP معتبر نیست." }, 400);
  if (action === "unblock") { await db.prepare("UPDATE ip_blocklist SET unblocked_at=CURRENT_TIMESTAMP WHERE ip_address=? AND unblocked_at IS NULL").bind(ip).run(); await audit(db, actor.admin_id, "ip_unblocked", null, actor.ip_address, { ip }); return json({ success: true }); }
  await db.prepare("INSERT INTO ip_blocklist (ip_address,reason,blocked_by,blocked_at,unblocked_at) VALUES (?,?,?,CURRENT_TIMESTAMP,NULL) ON CONFLICT(ip_address) DO UPDATE SET reason=excluded.reason,blocked_by=excluded.blocked_by,blocked_at=CURRENT_TIMESTAMP,unblocked_at=NULL").bind(ip, reason, actor.admin_id).run();
  await db.prepare("UPDATE admin_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE ip_address=? AND revoked_at IS NULL").bind(ip).run();
  await audit(db, actor.admin_id, "ip_blocked", null, actor.ip_address, { ip, reason }); return json({ success: true });
}

async function requireSession(request, db) {
  const token = readCookie(request.headers.get("Cookie"), "payamake_session"); if (!token) return null;
  const tokenHash = await sha256(decodeURIComponent(token));
  return await db.prepare(`SELECT s.id AS session_id,s.admin_id,s.ip_address,a.full_name,a.username,a.email,a.is_active FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND a.is_active=1 LIMIT 1`).bind(tokenHash).first();
}

async function isIpBlocked(db, ip) { if (!ip) return false; const row = await db.prepare("SELECT id FROM ip_blocklist WHERE ip_address=? AND unblocked_at IS NULL LIMIT 1").bind(ip).first(); return Boolean(row); }
async function isRateLimited(db, username, ip) { const row = await db.prepare(`SELECT COUNT(*) AS c FROM login_attempts WHERE created_at >= datetime('now', ?) AND success=0 AND (email=? OR ip_address=?)`).bind(`-${15} minutes`, username, ip || "").first(); return Number(row?.c || 0) >= 8; }
async function recordAttempt(db, adminId, username, ip, userAgent, stage, success, reason) { await db.prepare(`INSERT INTO login_attempts (admin_id,email,ip_address,user_agent,stage,success,failure_reason) VALUES (?,?,?,?,?,?,?)`).bind(adminId, username, ip, userAgent, stage, success ? 1 : 0, reason).run(); }
async function audit(db, adminId, action, targetAdminId, ip, details) { await db.prepare("INSERT INTO security_audit_log (admin_id,action,target_admin_id,ip_address,details_json) VALUES (?,?,?,?,?)").bind(adminId || null, action, targetAdminId || null, ip || null, details == null ? null : JSON.stringify(details)).run(); }
async function generateRecoveryCodes(db, adminId) { const codes=[]; await db.prepare("DELETE FROM recovery_codes WHERE admin_id=? AND used_at IS NULL").bind(adminId).run(); for(let i=0;i<10;i++){const bytes=new Uint8Array(8);crypto.getRandomValues(bytes);const hex=bytesToHex(bytes).toUpperCase();const code=hex.slice(0,4)+"-"+hex.slice(4,8);await db.prepare("INSERT INTO recovery_codes (admin_id,code_hash) VALUES (?,?)").bind(adminId,await sha256(code)).run();codes.push(code);}return codes; }
async function createSession(db, adminId, ip, userAgent) { const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);const token=bytesToHex(bytes);const hash=await sha256(token);const id=crypto.randomUUID();const expires=new Date(Date.now()+SESSION_TTL_SECONDS*1000).toISOString();await db.prepare("INSERT INTO admin_sessions (id,admin_id,token_hash,ip_address,user_agent,expires_at) VALUES (?,?,?,?,?,?)").bind(id,adminId,hash,ip,userAgent,expires).run();return {cookie:sessionCookie(token,SESSION_TTL_SECONDS)}; }
async function createPreAuthToken(env, adminId, ip) { const payload={adminId,ip:ip||null,exp:Math.floor(Date.now()/1000)+PREAUTH_TTL_SECONDS};const encoded=base64UrlEncode(JSON.stringify(payload));const signature=await signValue(env,encoded);return `${encoded}.${signature}`; }
async function signValue(env,value){const keyMaterial=env.AUTH_ENCRYPTION_KEY||env.AUTH_SESSION_SECRET;if(!keyMaterial)throw new Error("AUTH_ENCRYPTION_KEY or AUTH_SESSION_SECRET is required.");const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(keyMaterial),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return bytesToHex(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value))));}
async function hashPassword(password){const salt=new Uint8Array(16);crypto.getRandomValues(salt);const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:PASSWORD_ITERATIONS,hash:"SHA-256"},key,256);return `pbkdf2$sha256$${PASSWORD_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(bits))}`;}
async function verifyPassword(password,stored){const p=String(stored||"").split("$");if(p.length!==5||p[0]!=="pbkdf2"||p[1]!=="sha256")return false;const iter=Number(p[2]);if(!Number.isFinite(iter)||iter<1)return false;const salt=hexToBytes(p[3]);const expected=hexToBytes(p[4]);const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);const bits=new Uint8Array(await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:iter,hash:"SHA-256"},key,expected.length*8));return safeEqualBytes(bits,expected);}
async function sha256(value){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(value)));return bytesToHex(new Uint8Array(digest));}
function normalizeUsername(value){return String(value||"").trim().toLowerCase();}
function getIp(request){return request.headers.get("CF-Connecting-IP")||request.headers.get("X-Forwarded-For")||null;}
function isValidIp(ip){return /^[0-9a-f:.]+$/i.test(ip)&&ip.length<=64;}
async function readJson(request){try{return await request.json();}catch{return null;}}
function readCookie(header,name){const match=String(header||"").match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));return match?match[1]:null;}
function sessionCookie(token,maxAge){return `payamake_session=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;}
function clearCookie(){return "payamake_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict";}
function json(data,status=200,cookie=null){const headers={"Content-Type":"application/json; charset=UTF-8","Cache-Control":"no-store"};if(cookie)headers["Set-Cookie"]=cookie;return new Response(JSON.stringify(data),{status,headers});}
function bytesToHex(bytes){return Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("");}
function hexToBytes(hex){const s=String(hex||"");const out=new Uint8Array(Math.floor(s.length/2));for(let i=0;i<out.length;i++)out[i]=parseInt(s.slice(i*2,i*2+2),16);return out;}
function safeEqualBytes(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a[i]^b[i];return x===0;}
function base64UrlEncode(value){const bytes=new TextEncoder().encode(value);let binary="";for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
