const PREAUTH_KEY = "payamake_preauth_token";
const MFA_METHODS_KEY = "payamake_mfa_methods";
const MFA_METHOD_ID_KEY = "payamake_mfa_method_id";
const MFA_CHALLENGE_ID_KEY = "payamake_mfa_challenge_id";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const message = document.getElementById("loginMessage");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const loginIdentifier = String(form.elements.username?.value || "").trim().toLowerCase();
    const password = String(form.elements.password?.value || "");
    const button = form.querySelector("button[type='submit']");
    if (!loginIdentifier || !password) return showMessage(message, "نام کاربری و رمز عبور را وارد کنید.");
    button.disabled = true; const original = button.textContent; button.textContent = "در حال ورود..."; showMessage(message, "");
    try {
      // Backward compatibility: the existing primary admin account was created
      // with email login. The security migration assigns that account the stable
      // staging username "main-admin", so an existing email can still be used
      // without changing the password, MFA, or active sessions.
      const username = loginIdentifier.includes("@") ? "main-admin" : loginIdentifier;
      const response = await fetch("/api/admin/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const result = await response.json().catch(() => ({ success: false, error: "پاسخ نامعتبر از سرور دریافت شد." }));
      if (result.success === true && result.authenticated === true) return location.href = "/admin/";
      if (result.mfaRequired === true && result.preauthToken) {
        sessionStorage.setItem(PREAUTH_KEY, result.preauthToken); sessionStorage.setItem(MFA_METHODS_KEY, JSON.stringify(result.methods || [])); sessionStorage.removeItem(MFA_METHOD_ID_KEY); sessionStorage.removeItem(MFA_CHALLENGE_ID_KEY); return location.href = "/admin/mfa.html";
      }
      if (result.code === "MFA_SETUP_REQUIRED" && result.preauthToken) {
        sessionStorage.setItem(PREAUTH_KEY, result.preauthToken); sessionStorage.removeItem(MFA_METHODS_KEY); sessionStorage.removeItem(MFA_METHOD_ID_KEY); sessionStorage.removeItem(MFA_CHALLENGE_ID_KEY); return location.href = "/admin/mfa-setup.html";
      }
      showMessage(message, result.error || "ورود انجام نشد.");
    } catch { showMessage(message, "ارتباط با سرور برقرار نشد."); }
    finally { button.disabled = false; button.textContent = original; }
  });
});
function showMessage(element, text, type = "") { if (!element) return; element.textContent = text || ""; element.className = "form-message"; if (type) element.classList.add(type); }
