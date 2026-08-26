const PASSWORD_ITERATIONS = 100000;
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const PREAUTH_TTL_SECONDS = 5 * 60;
const OTP_TTL_SECONDS = 5 * 60;
const MAX_LOGIN_FAILURES = 8;
const RATE_WINDOW_SECONDS = 15 * 60;
const MAX_MFA_FAILURES = 8;
const MFA_RATE_WINDOW_SECONDS = 15 * 60;

const DUMMY_PASSWORD_HASH =
  "pbkdf2$sha256$100000$00112233445566778899aabbccddeeff$" +
  "0000000000000000000000000000000000000000000000000000000000000000";

export async function handleAdminAuth(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!env.DB) return json({ success: false, error: "Database is not configured." }, 500);

  if (request.method === "POST" && path === "/api/admin/login") {
    return login(request, env);
  }

  if (request.method === "POST" && path === "/api/admin/mfa/setup") {
    return setupMfa(request, env);
  }

  if (request.method === "POST" && path === "/api/admin/mfa/setup/verify") {
    return verifyMfaSetup(request, env);
  }

  if (request.method === "POST" && path === "/api/admin/mfa/send") {
    return sendMfaOtp(request, env);
  }

  if (request.method === "POST" && path === "/api/admin/mfa/verify") {
    return verifyMfa(request, env);
  }

  if (request.method === "POST" && path === "/api/admin/logout") {
    return logout(request, env);
  }

  if (request.method === "GET" && path === "/api/admin/me") {
    return currentAdmin(request, env);
  }

  return json({ success: false, error: "Not Found" }, 404);
}

async function login(request, env) {
  const body = await readJson(request);
  if (!body) return json({ success: false, error: "داده ارسالی معتبر نیست." }, 400);

  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || null;
  const userAgent = request.headers.get("User-Agent") || null;

  if (!email || password.length < 1 || password.length > 256) {
    return json({ success: false, error: "ایمیل و رمز عبور الزامی است." }, 400);
  }

  if (await isRateLimited(env.DB, email, ip)) {
    await recordLoginAttempt(env.DB, null, email, ip, userAgent, "locked", false, "rate_limited");
    return json({ success: false, error: "تعداد تلاش‌های ورود بیش از حد مجاز است. کمی بعد دوباره تلاش کنید." }, 429);
  }

  const admin = await env.DB.prepare(
    "SELECT id, full_name, email, password_hash, is_active FROM admins WHERE email = ? LIMIT 1"
  ).bind(email).first();

  const passwordHash = admin?.password_hash || DUMMY_PASSWORD_HASH;
  const passwordOk = await verifyPassword(password, passwordHash);

  if (!admin || !passwordOk) {
    await recordLoginAttempt(
      env.DB,
      admin?.id || null,
      email,
      ip,
      userAgent,
      "password_failed",
      false,
      "invalid_credentials"
    );
    return json({ success: false, error: "ایمیل یا رمز عبور صحیح نیست." }, 401);
  }

  if (!admin.is_active) {
    await recordLoginAttempt(env.DB, admin.id, email, ip, userAgent, "locked", false, "account_inactive");
    return json({ success: false, error: "این حساب غیرفعال است." }, 403);
  }

  await recordLoginAttempt(env.DB, admin.id, email, ip, userAgent, "password_success", true, null);

  const methods = await env.DB.prepare(
    `SELECT id, method_type, destination_masked, is_primary
     FROM mfa_methods
     WHERE admin_id = ? AND is_enabled = 1 AND is_verified = 1
     ORDER BY is_primary DESC, id ASC`
  ).bind(admin.id).all();

  const requireMfa = env.AUTH_REQUIRE_MFA !== "false";
  const preauth = await createPreAuthToken(env, admin.id, ip);

  if (requireMfa && !methods.results?.length) {
    await recordLoginAttempt(env.DB, admin.id, email, ip, userAgent, "locked", false, "mfa_not_configured");
    return json({
      success: false,
      error: "برای این حساب احراز هویت دومرحله‌ای هنوز فعال نشده است.",
      code: "MFA_SETUP_REQUIRED",
      preauthToken: preauth,
    }, 403);
  }

  if (!methods.results?.length) {
    const session = await createSession(env.DB, admin.id, ip, userAgent);
    await markLastLogin(env.DB, admin.id);
    return json(
      { success: true, authenticated: true, mfaRequired: false },
      200,
      session.cookie
    );
  }


  return json({
    success: true,
    authenticated: false,
    mfaRequired: true,
    preauthToken: preauth,
    methods: methods.results.map((method) => ({
      id: method.id,
      type: method.method_type,
      destination: method.destination_masked,
      primary: Boolean(method.is_primary),
    })),
  });
}

async function setupMfa(request, env) {
  const body = await readJson(request);

  if (!body?.preauthToken) {
    return json({ success: false, error: "نشست احراز هویت ناقص است." }, 400);
  }

  const preauth = await verifyPreAuthToken(
    env,
    String(body.preauthToken)
  );

  if (!preauth) {
    return json({
      success: false,
      error: "نشست احراز هویت منقضی شده است."
    }, 401);
  }

  if (!env.AUTH_ENCRYPTION_KEY) {
    return json({
      success: false,
      error: "کلید رمزنگاری MFA تنظیم نشده است."
    }, 500);
  }

  const admin = await env.DB.prepare(
    `SELECT id, email, is_active
     FROM admins
     WHERE id = ?
     LIMIT 1`
  ).bind(preauth.adminId).first();

  if (!admin || !admin.is_active) {
    return json({
      success: false,
      error: "حساب مدیر معتبر نیست یا غیرفعال شده است."
    }, 403);
  }

  const existing = await env.DB.prepare(
    `SELECT id
     FROM mfa_methods
     WHERE admin_id = ?
       AND method_type = 'totp'
     LIMIT 1`
  ).bind(admin.id).first();

  if (existing) {
    return json({
      success: false,
      error: "روش TOTP برای این حساب قبلاً ایجاد شده است."
    }, 409);
  }

  const secret = await generateTotpSecret();

  const encryptedSecret = await encryptSecret(
    env.AUTH_ENCRYPTION_KEY,
    secret
  );

  const result = await env.DB.prepare(
    `INSERT INTO mfa_methods
      (
        admin_id,
        method_type,
        secret_encrypted,
        destination_masked,
        is_primary,
        is_verified,
        is_enabled
      )
     VALUES (?, 'totp', ?, 'TOTP', 1, 0, 1)`
  ).bind(
    admin.id,
    encryptedSecret
  ).run();

  return json({
    success: true,
    methodId: result.meta.last_row_id,
    type: "totp",
    secret,
    issuer: "PAYAMAKE",
    account: admin.email
  });
}


async function verifyMfaSetup(request, env) {
  const body = await readJson(request);
  if (!body?.preauthToken || !body?.methodId || !body?.code) {
    return json({ success: false, error: "اطلاعات راه‌اندازی MFA ناقص است." }, 400);
  }

  const preauth = await verifyPreAuthToken(env, String(body.preauthToken));
  if (!preauth) {
    return json({ success: false, error: "نشست احراز هویت منقضی شده است." }, 401);
  }

  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || null;
  const userAgent = request.headers.get("User-Agent") || null;


  const method = await env.DB.prepare(
    `SELECT id, admin_id, method_type, secret_encrypted, is_verified
     FROM mfa_methods
     WHERE id = ? AND admin_id = ? AND method_type = 'totp' AND is_enabled = 1
     LIMIT 1`
  ).bind(Number(body.methodId), preauth.adminId).first();

  if (!method) {
    return json({ success: false, error: "روش TOTP معتبر نیست." }, 400);
  }

  if (method.is_verified) {
    return json({ success: false, error: "این روش TOTP قبلاً تأیید شده است." }, 409);
  }

  const secret = await decryptSecret(env.AUTH_ENCRYPTION_KEY, method.secret_encrypted);
  if (!secret) {
    return json({ success: false, error: "Secret مربوط به MFA قابل بازیابی نیست." }, 500);
  }


  const valid = await verifyTotp(secret, String(body.code), Math.floor(Date.now() / 1000));
  if (!valid) {
    return json({ success: false, error: "کد Google Authenticator صحیح نیست." }, 401);
  }

  await env.DB.prepare(
    `UPDATE mfa_methods
     SET is_verified = 1,
         is_primary = 1,
         verified_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND admin_id = ?`
  ).bind(method.id, preauth.adminId).run();

  const recoveryCodes = await generateRecoveryCodes(env.DB, preauth.adminId);

  return json({
    success: true,
    verified: true,
    methodId: method.id,
    recoveryCodes
  });
}


async function generateRecoveryCodes(db, adminId) {
  const codes = [];

  await db.prepare(
    "DELETE FROM recovery_codes WHERE admin_id = ? AND used_at IS NULL"
  ).bind(adminId).run();

  for (let i = 0; i < 10; i++) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);

    const hex = bytesToHex(bytes).toUpperCase();
    const code = hex.slice(0, 4) + "-" + hex.slice(4, 8);
    const codeHash = await sha256(code);

    await db.prepare(
      `INSERT INTO recovery_codes (admin_id, code_hash)
       VALUES (?, ?)`
    ).bind(adminId, codeHash).run();

    codes.push(code);
  }

  return codes;
}

async function sendMfaOtp(request, env) {
  const body = await readJson(request);
  if (!body?.preauthToken || !body?.methodId) {
    return json({ success: false, error: "اطلاعات احراز هویت دومرحله‌ای ناقص است." }, 400);
  }

  const preauth = await verifyPreAuthToken(env, String(body.preauthToken));
  if (!preauth) return json({ success: false, error: "نشست احراز هویت منقضی شده است." }, 401);

  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || null;
  const userAgent = request.headers.get("User-Agent") || null;


  if (!method) return json({ success: false, error: "روش احراز هویت معتبر نیست." }, 400);
  if (method.method_type === "totp") {
    return json({ success: false, error: "برای Google Authenticator نیازی به ارسال کد نیست." }, 400);
  }

  const code = randomDigits(6);
  const challengeId = crypto.randomUUID();
  const codeHash = await sha256(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO otp_challenges (id, admin_id, method_id, code_hash, purpose, expires_at)
     VALUES (?, ?, ?, ?, 'login', ?)`
  ).bind(challengeId, preauth.adminId, method.id, codeHash, expiresAt).run();

  if (method.method_type === "sms_otp") {
    if (!env.SMSIR_API_KEY || !env.SMSIR_ADMIN_OTP_TEMPLATE_ID) {
      return json({ success: false, error: "ارسال OTP پیامکی هنوز در محیط staging پیکربندی نشده است." }, 503);
    }

    const mobile = await getMfaDestination(env, preauth.adminId, method.id);
    if (!mobile) return json({ success: false, error: "شماره موبایل MFA پیدا نشد." }, 500);

    const sent = await sendSmsOtp(env, mobile, code);
    if (!sent) {
      await env.DB.prepare("DELETE FROM otp_challenges WHERE id = ?").bind(challengeId).run();
      return json({ success: false, error: "ارسال کد OTP انجام نشد." }, 502);
    }
  } else if (method.method_type === "email_otp") {
    await env.DB.prepare("DELETE FROM otp_challenges WHERE id = ?").bind(challengeId).run();
    return json({ success: false, error: "Email OTP provider هنوز به Worker متصل نشده است." }, 503);
  }

  return json({ success: true, challengeId, expiresIn: OTP_TTL_SECONDS });
}

async function verifyMfa(request, env) {
  const body = await readJson(request);
  if (!body?.preauthToken || !body?.methodId || !body?.code) {
    return json({ success: false, error: "اطلاعات کد دومرحله‌ای ناقص است." }, 400);
  }

  const preauth = await verifyPreAuthToken(env, String(body.preauthToken));
  if (!preauth) {
    return json({ success: false, error: "نشست احراز هویت منقضی شده است." }, 401);
  }

  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || null;
  const userAgent = request.headers.get("User-Agent") || null;

  if (await isMfaRateLimited(env.DB, preauth.adminId)) {
    await recordLoginAttempt(env.DB, preauth.adminId, null, ip, userAgent, "locked", false, "mfa_rate_limited");
    return json({
      success: false,
      error: "تعداد تلاش‌های احراز هویت دومرحله‌ای بیش از حد مجاز است. کمی بعد دوباره تلاش کنید."
    }, 429);
  }


  const method = await env.DB.prepare(
    `SELECT id, admin_id, method_type
     FROM mfa_methods
     WHERE id = ? AND admin_id = ? AND is_enabled = 1 AND is_verified = 1
     LIMIT 1`
  ).bind(Number(body.methodId), preauth.adminId).first();

  if (!method) {
    return json({ success: false, error: "روش احراز هویت معتبر نیست." }, 400);
  }

  const submittedCode = String(body.code || "")
    .trim()
    .toUpperCase();

  let valid = false;
  let usedRecoveryCode = false;

  if (method.method_type === "totp") {
    /*
     * TOTP:
     * 6 digits -> Google Authenticator
     *
     * Recovery:
     * XXXX-XXXX -> one-time recovery code
     */
    if (/^\d{6}$/.test(submittedCode)) {
      if (!env.AUTH_ENCRYPTION_KEY) {
        return json({
          success: false,
          error: "کلید رمزنگاری MFA تنظیم نشده است."
        }, 500);
      }

      const row = await env.DB.prepare(
        "SELECT secret_encrypted FROM mfa_methods WHERE id = ? AND admin_id = ? LIMIT 1"
      ).bind(method.id, preauth.adminId).first();

      const secret = await decryptSecret(
        env.AUTH_ENCRYPTION_KEY,
        row?.secret_encrypted
      );

      valid = Boolean(
        secret &&
        await verifyTotp(
          secret,
          submittedCode,
          Math.floor(Date.now() / 1000)
        )
      );
    } else {
      const recoveryCode = submittedCode.replace(/\s+/g, "");

      if (/^[A-F0-9]{4}-[A-F0-9]{4}$/.test(recoveryCode)) {
        const codeHash = await sha256(recoveryCode);

        const recovery = await env.DB.prepare(
          `SELECT id
           FROM recovery_codes
           WHERE admin_id = ? AND code_hash = ? AND used_at IS NULL
           LIMIT 1`
        ).bind(preauth.adminId, codeHash).first();

        if (recovery) {
          const consumed = await env.DB.prepare(
            `UPDATE recovery_codes
             SET used_at = CURRENT_TIMESTAMP
             WHERE id = ? AND admin_id = ? AND used_at IS NULL`
          ).bind(recovery.id, preauth.adminId).run();

          valid =
            Number(consumed.meta?.changes || 0) === 1;

          usedRecoveryCode = valid;
        }
      }
    }
  } else {
    const challenge = await env.DB.prepare(
      `SELECT id, code_hash, attempts, max_attempts, expires_at, consumed_at
       FROM otp_challenges
       WHERE id = ? AND admin_id = ? AND method_id = ? AND purpose = 'login'
       LIMIT 1`
    ).bind(
      String(body.challengeId || ""),
      preauth.adminId,
      method.id
    ).first();

    if (!challenge) {
      return json({
        success: false,
        error: "کد OTP معتبر نیست."
      }, 400);
    }

    if (
      challenge.consumed_at ||
      new Date(challenge.expires_at).getTime() <= Date.now()
    ) {
      return json({
        success: false,
        error: "کد OTP منقضی شده است."
      }, 400);
    }

    if (
      Number(challenge.attempts) >=
      Number(challenge.max_attempts)
    ) {
      return json({
        success: false,
        error: "تعداد تلاش‌های این کد تمام شده است."
      }, 429);
    }

    const submittedHash = await sha256(
      String(body.code).replace(/\D/g, "")
    );

    valid = safeEqualHex(
      submittedHash,
      challenge.code_hash
    );

    await env.DB.prepare(
      "UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?"
    ).bind(challenge.id).run();

    if (valid) {
      await env.DB.prepare(
        "UPDATE otp_challenges SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(challenge.id).run();
    }
  }


  if (!valid) {
    await recordLoginAttempt(
      env.DB,
      preauth.adminId,
      null,
      ip,
      userAgent,
      "mfa_failed",
      false,
      "invalid_mfa"
    );

    return json({
      success: false,
      error: "کد احراز هویت صحیح نیست."
    }, 401);
  }

  const session = await createSession(
    env.DB,
    preauth.adminId,
    ip,
    userAgent
  );

  await markLastLogin(
    env.DB,
    preauth.adminId
  );

  await recordLoginAttempt(
    env.DB,
    preauth.adminId,
    null,
    ip,
    userAgent,
    "mfa_success",
    true,
    usedRecoveryCode ? "recovery_code" : null
  );

  return json({
    success: true,
    authenticated: true,
    mfaRequired: true,
    usedRecoveryCode
  }, 200, session.cookie);
}
async function logout(request, env) {
  const token = readCookie(request.headers.get("Cookie"), "payamake_session");
  if (token) {
    const tokenHash = await sha256(token);
    await env.DB.prepare("UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ? AND revoked_at IS NULL")
      .bind(tokenHash).run();
  }
  return json({ success: true }, 200, clearCookie());
}

async function currentAdmin(request, env) {
  const token = readCookie(request.headers.get("Cookie"), "payamake_session");
  if (!token) return json({ success: false, authenticated: false }, 401);

  const tokenHash = await sha256(token);
  const session = await env.DB.prepare(
    `SELECT s.id, s.expires_at, a.id AS admin_id, a.full_name, a.email
     FROM admin_sessions s
     JOIN admins a ON a.id = s.admin_id
     WHERE s.token_hash = ? AND s.revoked_at IS NULL AND a.is_active = 1
       AND s.expires_at > CURRENT_TIMESTAMP
     LIMIT 1`
  ).bind(tokenHash).first();

  if (!session) return json({ success: false, authenticated: false }, 401, clearCookie());
  return json({ success: true, authenticated: true, admin: { id: session.admin_id, fullName: session.full_name, email: session.email } });
}

async function createSession(db, adminId, ip, userAgent) {
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = bytesToHex(tokenBytes);
  const tokenHash = await sha256(token);
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  await db.prepare(
    `INSERT INTO admin_sessions (id, admin_id, token_hash, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(sessionId, adminId, tokenHash, ip, userAgent, expiresAt).run();

  return { token, cookie: sessionCookie(token, SESSION_TTL_SECONDS) };
}

async function createPreAuthToken(env, adminId, ip) {
  const payload = { adminId, ip: ip || null, exp: Math.floor(Date.now() / 1000) + PREAUTH_TTL_SECONDS };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = await signValue(env, encoded);
  return `${encoded}.${signature}`;
}

async function verifyPreAuthToken(env, token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expected = await signValue(env, encoded);
  if (!safeEqualHex(signature, expected)) return null;
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encoded));
  } catch {
    return null;
  }
  if (!payload?.adminId || Number(payload.exp) <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

async function signValue(env, value) {
  const keyMaterial = env.AUTH_ENCRYPTION_KEY || env.AUTH_SESSION_SECRET;
  if (!keyMaterial) throw new Error("AUTH_ENCRYPTION_KEY or AUTH_SESSION_SECRET is required.");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(signature));
}

async function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") return false;
  const iterations = Number(parts[2]);
  const salt = hexToBytes(parts[3]);
  const expected = hexToBytes(parts[4]);
  if (!iterations || !salt || !expected || expected.length !== 32) return false;

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    expected.length * 8
  );
  return crypto.subtle.timingSafeEqual(derived, expected);
}

export async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PASSWORD_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return `pbkdf2$sha256$${PASSWORD_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(derived))}`;
}

async function verifyTotp(secret, code, nowSeconds) {
  const normalized = String(code).replace(/\D/g, "");
  if (normalized.length !== 6) return false;
  const counter = Math.floor(nowSeconds / 30);
  for (let offset = -1; offset <= 1; offset++) {
    const generated = await hotp(secret, counter + offset);
    if (safeEqualString(generated, normalized)) return true;
  }
  return false;
}

async function hotp(secret, counter) {
  const keyBytes = base32Decode(secret);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter >>> 0);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, buffer));
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 1000000).padStart(6, "0");
}

async function generateTotpSecret() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

async function encryptSecret(keyMaterial, plaintext) {
  const rawKey = base64UrlToBytes(keyMaterial);
  if (rawKey.length !== 32) throw new Error("AUTH_ENCRYPTION_KEY must decode to 32 bytes.");

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );

  return `${base64UrlEncodeBytes(iv)}.${base64UrlEncodeBytes(new Uint8Array(ciphertext))}`;
}


async function decryptSecret(keyMaterial, packed) {
  if (!packed) return null;
  try {
    const rawKey = base64UrlToBytes(keyMaterial);
    if (rawKey.length !== 32) return null;
    const [ivPart, cipherPart] = String(packed).split(".");
    const iv = base64UrlToBytes(ivPart);
    const ciphertext = base64UrlToBytes(cipherPart);
    const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}

async function sendSmsOtp(env, mobile, code) {
  const response = await fetch("https://api.sms.ir/v1/send/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": env.SMSIR_API_KEY },
    body: JSON.stringify({
      mobile,
      templateId: Number(env.SMSIR_ADMIN_OTP_TEMPLATE_ID),
      parameters: [{ name: "CODE", value: code }],
    }),
  });
  return response.ok;
}

async function getMfaDestination(env, adminId, methodId) {
  const row = await env.DB.prepare("SELECT destination_masked FROM mfa_methods WHERE id = ? AND admin_id = ? LIMIT 1")
    .bind(methodId, adminId).first();
  // The real destination must be supplied from a dedicated secret or later enrollment flow.
  // Masked DB values are intentionally never treated as sendable phone numbers.
  return env.ADMIN_MOBILE || row?.destination_masked || null;
}

async function isRateLimited(db, email, ip) {
  const cutoff = new Date(Date.now() - RATE_WINDOW_SECONDS * 1000).toISOString();
  const row = await db.prepare(
    `SELECT COUNT(*) AS failures
     FROM login_attempts
     WHERE created_at >= ? AND success = 0
       AND (email = ? OR (? IS NOT NULL AND ip_address = ?))`
  ).bind(cutoff, email, ip, ip).first();
  return Number(row?.failures || 0) >= MAX_LOGIN_FAILURES;
}



async function isMfaRateLimited(db, adminId) {
  const cutoff = new Date(Date.now() - MFA_RATE_WINDOW_SECONDS * 1000).toISOString().replace("T", " ").replace("Z", "");
  const row = await db.prepare(
    `SELECT COUNT(*) AS failures
     FROM login_attempts
     WHERE created_at >= ?
       AND stage = 'mfa_failed'
       AND success = 0
       AND admin_id = ?`
  ).bind(cutoff, adminId).first();
  return Number(row?.failures || 0) >= MAX_MFA_FAILURES;
}


async function recordLoginAttempt(db, adminId, email, ip, userAgent, stage, success, failureReason) {
  await db.prepare(
    `INSERT INTO login_attempts (admin_id, email, ip_address, user_agent, stage, success, failure_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(adminId, email, ip, userAgent, stage, success ? 1 : 0, failureReason).run();
}

async function markLastLogin(db, adminId) {
  await db.prepare("UPDATE admins SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(adminId).run();
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return bytesToHex(new Uint8Array(digest));
}

function safeEqualHex(a, b) {
  try {
    const aa = hexToBytes(a);
    const bb = hexToBytes(b);
    if (aa.length !== bb.length) return false;
    return crypto.subtle.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

function safeEqualString(a, b) {
  const aa = new TextEncoder().encode(String(a));
  const bb = new TextEncoder().encode(String(b));
  if (aa.length !== bb.length) return false;
  return crypto.subtle.timingSafeEqual(aa, bb);
}

function randomDigits(length) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => String(value % 10)).join("");
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function sessionCookie(token, maxAge) {
  return `payamake_session=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

function clearCookie() {
  return "payamake_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict";
}

function readCookie(header, name) {
  const cookies = String(header || "").split(";");
  for (const item of cookies) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function json(data, status = 200, setCookie = null) {
  const headers = { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" };
  if (setCookie) headers["Set-Cookie"] = setCookie;
  return new Response(JSON.stringify(data), { status, headers });
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  if (!/^[0-9a-f]+$/i.test(String(hex)) || String(hex).length % 2 !== 0) return null;
  const output = new Uint8Array(String(hex).length / 2);
  for (let i = 0; i < output.length; i++) output[i] = Number.parseInt(String(hex).slice(i * 2, i * 2 + 2), 16);
  return output;
}

function base64UrlEncode(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = String(value).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(value).length + 3) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function base64UrlToBytes(value) {
  const padded = String(value).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(value).length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = String(input).toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = "";
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error("Invalid base32 secret.");
    bits += index.toString(2).padStart(5, "0");
  }
  const output = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) output.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return new Uint8Array(output);
}

function base32Encode(bytes) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let output = "";
  let buffer = 0;
  let bits = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      output += alphabet[(buffer >> bits) & 31];
    }
  }

  if (bits > 0) {
    output += alphabet[(buffer << (5 - bits)) & 31];
  }

  return output;
}
