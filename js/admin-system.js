(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  async function api(path, options = {}) {
    const r = await fetch(path, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const data = await r.json().catch(() => ({ success: false, error: 'پاسخ نامعتبر' }));
    if (r.status === 401) { location.href = '/admin/login.html'; throw new Error('احراز هویت لازم است.'); }
    if (!r.ok || data.success === false) throw new Error(data.error || 'خطای سرور');
    return data;
  }

  function toast(text, type = 'success') {
    let el = $('#systemToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'systemToast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.style.cssText = 'position:fixed;top:24px;right:24px;z-index:10000;max-width:min(460px,calc(100vw - 48px));padding:13px 18px;border-radius:12px;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.14);font-size:14px;font-weight:700;transition:opacity .2s ease,transform .2s ease;';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.border = `1px solid ${type === 'error' ? '#fecaca' : '#bbf7d0'}`;
    el.style.color = type === 'error' ? '#991b1b' : '#166534';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-8px)'; }, 3200);
  }

  function levelLabel(level) {
    return ({error:'خطا', warn:'هشدار', info:'اطلاعات'}[level] || level || '—');
  }

  function renderLogs(rows) {
    const box = $('#systemLogsTable');
    if (!box) return;
    if (!rows.length) { box.innerHTML = '<div class="sms-empty">هنوز خطای سیستمی ثبت نشده است.</div>'; return; }
    box.innerHTML = `<div class="system-log-list">${rows.map((r) => {
      let details = '';
      try { details = r.details_json ? JSON.stringify(JSON.parse(r.details_json), null, 2) : ''; } catch { details = String(r.details_json || ''); }
      const cls = r.level === 'error' ? 'system-log-error' : r.level === 'warn' ? 'system-log-warn' : 'system-log-info';
      return `<article class="system-log-item ${cls}"><div class="system-log-head"><span class="system-log-level">${esc(levelLabel(r.level))}</span><strong>${esc(r.source)}</strong><time dir="ltr">${esc(r.created_at)}</time></div><div class="system-log-message">${esc(r.message || '—')}</div>${details ? `<details><summary>جزئیات فنی</summary><pre>${esc(details)}</pre></details>` : ''}</article>`;
    }).join('')}</div>`;
  }

  async function loadSystemLogs({ notify = false } = {}) {
    const box = $('#systemLogsTable');
    if (box) box.innerHTML = '<div class="sms-loading">در حال دریافت لاگ‌های سیستم...</div>';
    try {
      const d = await api('/api/admin/system/logs?limit=100');
      renderLogs(d.logs || []);
      if (notify) toast(`${(d.logs || []).length} رویداد سیستمی دریافت شد.`);
    } catch (e) {
      if (box) box.innerHTML = `<div class="sms-empty">${esc(e.message)}</div>`;
      if (notify) toast(`دریافت لاگ‌های سیستم ناموفق بود: ${e.message}`, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!(location.pathname === '/admin/' || location.pathname === '/admin/index.html')) return;
    $('#refreshSystemLogs')?.addEventListener('click', async () => {
      const b = $('#refreshSystemLogs');
      b.disabled = true;
      const old = b.textContent;
      b.textContent = 'در حال بروزرسانی...';
      try { await loadSystemLogs({ notify: true }); } finally { b.disabled = false; b.textContent = old; }
    });
    loadSystemLogs();
  });
})();
