(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  async function api(path, options = {}) {
    const r = await fetch(path, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const data = await r.json().catch(() => ({ success: false, error: 'پاسخ نامعتبر' }));
    if (r.status === 401) { location.href = '/admin/login.html'; throw new Error('احراز هویت لازم است.'); }
    if (!r.ok || data.success === false) throw new Error(data.error || 'خطای سرور');
    return data;
  }
  function toast(text, error = false) {
    let el = $('#monitoringToast');
    if (!el) { el = document.createElement('div'); el.id = 'monitoringToast'; el.style.cssText = 'position:fixed;top:24px;right:24px;z-index:10002;max-width:min(460px,calc(100vw - 48px));padding:13px 18px;border-radius:12px;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.14);font-size:14px;font-weight:700;transition:.2s;'; document.body.appendChild(el); }
    el.textContent = text; el.style.border = `1px solid ${error ? '#fecaca' : '#bbf7d0'}`; el.style.color = error ? '#991b1b' : '#166534'; el.style.opacity = '1'; clearTimeout(el._timer); el._timer = setTimeout(() => el.style.opacity = '0', 3000);
  }
  function bool(v) { return String(v) === '1' || String(v) === 'true'; }
  function inject() {
    const security = $('#security'); if (!security || $('#monitoringSettingsCard')) return;
    const card = document.createElement('div'); card.id = 'monitoringSettingsCard'; card.className = 'sms-section-card monitoring-settings-card';
    card.innerHTML = `<div class="sms-section-title"><div><h3>تنظیمات مانیتورینگ</h3><span>کنترل رفتار Cron و ثبت خطاهای سیستمی بدون تغییر در کد.</span></div><button id="saveMonitoringSettings" class="admin-button primary small" type="button">ذخیره تنظیمات</button></div><div id="monitoringSettingsMessage" class="form-message"></div><div class="monitoring-settings-grid"><label class="monitoring-setting"><span><strong>مانیتورینگ Delivery پیامک</strong><small>هر ۵ دقیقه اجرا می‌شود و فقط پیام‌های Pending را بررسی می‌کند.</small></span><input id="settingDelivery" type="checkbox"></label><label class="monitoring-setting"><span><strong>ثبت خطاهای سیستمی</strong><small>خطاهای Worker، Cron و API در System Logs ثبت شوند.</small></span><input id="settingErrors" type="checkbox"></label><label class="monitoring-setting"><span><strong>ثبت اجرای موفق Cron</strong><small>خاموش = اجرای عادی Cron لاگ نمی‌سازد.</small></span><input id="settingCronSuccess" type="checkbox"></label><label class="monitoring-setting"><span><strong>جلوگیری از خطاهای تکراری</strong><small>خطای یکسان در بازه مشخص دوباره رکورد نمی‌سازد.</small></span><input id="settingDedupe" type="checkbox"></label><label class="monitoring-setting monitoring-setting-wide"><span><strong>فاصله ثبت مجدد خطای مشابه</strong><small>بر حسب دقیقه؛ بین ۱ دقیقه تا ۲۴ ساعت.</small></span><div class="monitoring-number"><input id="settingCooldown" type="number" min="1" max="1440" step="1"><span>دقیقه</span></div></label></div>`;
    security.querySelector('.system-log-card')?.before(card) || security.appendChild(card);
    $('#saveMonitoringSettings').onclick = save;
    load();
  }
  async function load() {
    try { const d = await api('/api/admin/system/settings'); const s = d.settings || {}; $('#settingDelivery').checked = bool(s.delivery_monitoring_enabled); $('#settingErrors').checked = bool(s.system_error_logging_enabled); $('#settingCronSuccess').checked = bool(s.log_successful_crons); $('#settingDedupe').checked = bool(s.duplicate_error_suppression_enabled); $('#settingCooldown').value = Number(s.error_cooldown_minutes || 30); } catch (e) { toast(`دریافت تنظیمات ناموفق بود: ${e.message}`, true); }
  }
  async function save() {
    const b = $('#saveMonitoringSettings'); b.disabled = true; const old = b.textContent; b.textContent = 'در حال ذخیره...';
    try {
      await api('/api/admin/system/settings', { method: 'POST', body: JSON.stringify({ delivery_monitoring_enabled: $('#settingDelivery').checked ? '1' : '0', system_error_logging_enabled: $('#settingErrors').checked ? '1' : '0', log_successful_crons: $('#settingCronSuccess').checked ? '1' : '0', duplicate_error_suppression_enabled: $('#settingDedupe').checked ? '1' : '0', error_cooldown_minutes: $('#settingCooldown').value }) });
      toast('تنظیمات مانیتورینگ با موفقیت ذخیره شد.');
    } catch (e) { toast(`ذخیره تنظیمات ناموفق بود: ${e.message}`, true); } finally { b.disabled = false; b.textContent = old; }
  }
  document.addEventListener('DOMContentLoaded', () => { if (location.pathname === '/admin/' || location.pathname === '/admin/index.html') { setTimeout(inject, 300); } });
})();
