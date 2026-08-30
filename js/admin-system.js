(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const fallbackSamples = { lead_customer: 'سلام {FULLNAME}، درخواست شما با موفقیت ثبت شد.', lead_admin: 'Lead جدید: {FULLNAME} - {PHONE}' };
  const fallbackVariables = { lead_customer: ['FULLNAME'], lead_admin: ['FULLNAME','PHONE','BRAND','TYPE','DESCRIPTION'] };

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
      el = document.createElement('div'); el.id = 'systemToast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
      el.style.cssText = 'position:fixed;top:24px;right:24px;z-index:10000;max-width:min(460px,calc(100vw - 48px));padding:13px 18px;border-radius:12px;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.14);font-size:14px;font-weight:700;transition:opacity .2s ease,transform .2s ease;';
      document.body.appendChild(el);
    }
    el.textContent = text; el.style.border = `1px solid ${type === 'error' ? '#fecaca' : '#bbf7d0'}`; el.style.color = type === 'error' ? '#991b1b' : '#166534'; el.style.opacity = '1'; el.style.transform = 'translateY(0)';
    clearTimeout(el._timer); el._timer = setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(-8px)'; }, 3200);
  }

  function levelLabel(level) { return ({error:'خطا', warn:'هشدار', info:'اطلاعات'}[level] || level || '—'); }

  function pagination(totalPages, currentPage, onPage) {
    if (!totalPages || totalPages <= 1) return '';
    const items = [];
    const add = (n) => items.push(`<button type="button" class="system-pagination-button${n === currentPage ? ' active' : ''}" data-page="${n}">${n}</button>`);
    const dots = () => items.push('<span class="system-pagination-dots">…</span>');
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) add(i); }
    else { add(1); if (currentPage > 4) dots(); for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) add(i); if (currentPage < totalPages - 3) dots(); add(totalPages); }
    setTimeout(() => $$('.system-pagination-button[data-page]').forEach(b => b.onclick = () => onPage(Number(b.dataset.page))), 0);
    return `<div class="system-pagination" role="navigation" aria-label="صفحه‌بندی"><button type="button" class="system-pagination-button nav" data-page="${Math.max(1,currentPage-1)}" ${currentPage <= 1 ? 'disabled' : ''}>قبلی</button>${items.join('')}<button type="button" class="system-pagination-button nav" data-page="${Math.min(totalPages,currentPage+1)}" ${currentPage >= totalPages ? 'disabled' : ''}>بعدی</button></div>`;
  }

  function renderLogs(rows, pageInfo) {
    const box = $('#systemLogsTable'); if (!box) return;
    if (!rows.length) { box.innerHTML = '<div class="sms-empty">هنوز خطای سیستمی ثبت نشده است.</div>'; return; }
    box.innerHTML = `<div class="system-log-list">${rows.map((r) => {
      let details = ''; try { details = r.details_json ? JSON.stringify(JSON.parse(r.details_json), null, 2) : ''; } catch { details = String(r.details_json || ''); }
      const cls = r.level === 'error' ? 'system-log-error' : r.level === 'warn' ? 'system-log-warn' : 'system-log-info';
      return `<article class="system-log-item ${cls}"><div class="system-log-head"><span class="system-log-level">${esc(levelLabel(r.level))}</span><strong>${esc(r.source)}</strong><time dir="ltr">${esc(r.created_at)}</time></div><div class="system-log-message">${esc(r.message || '—')}</div>${details ? `<details><summary>جزئیات فنی</summary><pre>${esc(details)}</pre></details>` : ''}</article>`;
    }).join('')}</div>${pagination(pageInfo.totalPages, pageInfo.page, loadSystemLogs)} `;
  }

  async function loadSystemLogs(page = 1, notify = false) {
    const box = $('#systemLogsTable'); if (box) box.innerHTML = '<div class="sms-loading">در حال دریافت لاگ‌های سیستم...</div>';
    try {
      const d = await api(`/api/admin/system/logs?pageSize=20&page=${page}`);
      renderLogs(d.logs || [], d.pagination || { page, totalPages: 1 });
      if (notify) toast(`${d.pagination?.total || (d.logs || []).length} رویداد سیستمی دریافت شد.`);
    } catch (e) { if (box) box.innerHTML = `<div class="sms-empty">${esc(e.message)}</div>`; if (notify) toast(`دریافت لاگ‌های سیستم ناموفق بود: ${e.message}`, 'error'); }
  }

  function installSystemLogAccordion() {
    const card = $('.system-log-card');
    if (!card || card.dataset.accordionReady === '1') return;
    const title = card.querySelector('.sms-section-title');
    const body = $('#systemLogsTable');
    if (!title || !body) return;

    const refresh = $('#refreshSystemLogs');
    const titleArea = title.querySelector('div:first-child');
    if (!titleArea) return;

    const key = 'payamake_system_logs_open';
    let open = localStorage.getItem(key) === '1';
    card.dataset.accordionReady = '1';
    card.classList.add('system-log-accordion');
    titleArea.classList.add('system-log-accordion-trigger');
    titleArea.setAttribute('role', 'button');
    titleArea.setAttribute('tabindex', '0');
    titleArea.setAttribute('aria-controls', 'systemLogsTable');

    const sync = () => {
      card.classList.toggle('is-open', open);
      body.hidden = !open;
      titleArea.setAttribute('aria-expanded', String(open));
      const indicator = titleArea.querySelector('.system-log-accordion-indicator');
      if (indicator) indicator.textContent = open ? 'بستن' : 'باز کردن';
    };

    const toggle = () => {
      open = !open;
      localStorage.setItem(key, open ? '1' : '0');
      sync();
    };

    if (!titleArea.querySelector('.system-log-accordion-indicator')) {
      const indicator = document.createElement('span');
      indicator.className = 'system-log-accordion-indicator';
      titleArea.appendChild(indicator);
    }

    titleArea.addEventListener('click', (event) => {
      if (refresh && (event.target === refresh || refresh.contains(event.target))) return;
      toggle();
    });
    titleArea.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    });
    sync();
  }

  function injectStyles() {
    if ($('#systemLogAccordionStyles')) return;
    const style = document.createElement('style');
    style.id = 'systemLogAccordionStyles';
    style.textContent = `
      .system-log-accordion .system-log-accordion-trigger{cursor:pointer;user-select:none;display:flex;align-items:center;gap:12px;min-width:0}
      .system-log-accordion .system-log-accordion-trigger>div:first-child{min-width:0;flex:1}
      .system-log-accordion .system-log-accordion-indicator{display:inline-flex;align-items:center;justify-content:center;min-width:74px;padding:6px 10px;border:1px solid rgba(15,23,42,.12);border-radius:9px;font-size:11px;font-weight:700;color:#475467;background:#f8fafc;flex:0 0 auto}
      .system-log-accordion .system-log-accordion-indicator::before{content:'⌄';margin-left:5px;font-size:14px;transition:transform .18s ease}
      .system-log-accordion.is-open .system-log-accordion-indicator::before{transform:rotate(180deg)}
      .system-log-accordion .system-log-accordion-trigger:focus-visible{outline:3px solid rgba(37,99,235,.18);outline-offset:3px;border-radius:10px}
      .system-log-accordion #systemLogsTable[hidden]{display:none!important}
      .system-log-accordion .system-log-item pre{overflow:visible;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}
      @media(max-width:700px){.system-log-accordion .system-log-accordion-trigger{align-items:flex-start}.system-log-accordion .system-log-accordion-indicator{min-width:64px}}
    `;
    document.head.appendChild(style);
  }

  async function hydrateSmsTemplates() {
    const cards = $$('#templatesList .template-card');
    if (!cards.length) return;
    try {
      const d = await api('/api/admin/sms/logs?pageSize=100&page=1');
      const latest = {};
      for (const row of d.logs || []) {
        const key = `${row.provider_key}:${row.purpose}`;
        if (!latest[key]) latest[key] = row;
      }
      cards.forEach(card => {
        const ref = card.querySelector('[data-ref]');
        const message = card.querySelector('[data-message]');
        const vars = card.querySelector('[data-variables]');
        if (!ref && !message && !vars) return;
        const heading = card.querySelector('.template-head strong')?.textContent || '';
        const purpose = heading.includes('پیامک مشتری') ? 'lead_customer' : heading.includes('پیامک مدیر') ? 'lead_admin' : '';
        const provider = heading.includes('SMS.ir') ? 'sms_ir' : heading.includes('Niazpardaz') ? 'niazpardaz' : '';
        const row = latest[`${provider}:${purpose}`];
        if (provider === 'sms_ir' && row) {
          if (ref && !ref.value) ref.value = row.template_id || '';
          if (message && !message.value) message.value = row.message || '';
        }
        if (vars && (!vars.value || vars.value === '[]')) vars.value = JSON.stringify(fallbackVariables[purpose] || []);
        if (message && !message.value) message.value = fallbackSamples[purpose] || '';
      });
    } catch (e) {
      console.warn('SMS template hydration failed:', e);
    }
  }

  function installSmsTemplateHydration() {
    document.addEventListener('click', (e) => {
      const tab = e.target.closest('.sms-tab[data-tab="templates"]');
      if (tab) {
        let tries = 0;
        const timer = setInterval(async () => {
          tries++;
          await hydrateSmsTemplates();
          if ($('#templatesList .template-card') || tries >= 12) clearInterval(timer);
        }, 250);
      }
    });
    setTimeout(hydrateSmsTemplates, 800);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!(location.pathname === '/admin/' || location.pathname === '/admin/index.html')) return;
    injectStyles();
    setTimeout(installSystemLogAccordion, 50);
    $('#refreshSystemLogs')?.addEventListener('click', async () => { const b = $('#refreshSystemLogs'); b.disabled = true; const old = b.textContent; b.textContent = 'در حال بروزرسانی...'; try { await loadSystemLogs(1, true); } finally { b.disabled = false; b.textContent = old; } });
    installSmsTemplateHydration();
  });
})();
