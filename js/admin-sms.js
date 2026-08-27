(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const purposeLabel = (p) => p === 'lead_customer' ? 'پیامک مشتری' : p === 'lead_admin' ? 'پیامک مدیر' : p;
  const status = (v) => `<span class="sms-status ${esc(v)}">${({sent:'ارسال شده',failed:'ناموفق',pending:'در انتظار',delivered:'دلیور شده',unknown:'نامشخص',expired:'منقضی'}[v] || esc(v || '—'))}</span>`;

  async function api(path, options = {}) {
    const r = await fetch(path, { credentials: 'include', ...options, headers: {'Content-Type':'application/json', ...(options.headers || {})} });
    const data = await r.json().catch(() => ({success:false,error:'پاسخ نامعتبر'}));
    if (r.status === 401) { location.href = '/admin/login.html'; throw new Error('احراز هویت لازم است.'); }
    if (!r.ok || data.success === false) throw new Error(data.error || 'خطای سرور');
    return data;
  }

  function showMessage(text, type = '') { const el = $('#smsMessage'); if (!el) return; el.textContent = text || ''; el.className = `form-message ${type}`; }

  function activateTab(name) {
    $$('.sms-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $$('.sms-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
    if (name === 'overview') loadOverview();
    if (name === 'providers') loadProviders();
    if (name === 'templates') loadTemplates();
    if (name === 'logs') loadLogs();
  }

  async function loadOverview() {
    try {
      const d = await api('/api/admin/sms/overview');
      const t = d.totals || {};
      $('#smsStats').innerHTML = [
        ['کل پیامک‌ها', t.total || 0], ['ارسال موفق', t.sent || 0], ['ناموفق', t.failed || 0], ['دلیور شده', t.delivered || 0], ['در انتظار دلیوری', t.delivery_pending || 0]
      ].map(x => `<article class="sms-stat"><span>${x[0]}</span><strong>${x[1]}</strong></article>`).join('');
      $('#providerSummary').innerHTML = (d.providers || []).map(providerCard).join('') || empty('هنوز Provider ثبت نشده است.');
      $('#recentLogs').innerHTML = logsTable(d.recent || [], true);
    } catch (e) { showMessage(e.message, 'error'); }
  }

  function providerCard(p) {
    const key = p.provider_key === 'sms_ir' ? 'SMS.ir' : 'Niazpardaz';
    return `<article class="provider-card"><div class="provider-head"><div><span class="provider-name">${key}</span><small>${esc(p.provider_key)}</small></div>${p.is_default ? '<span class="default-badge">Default</span>' : ''}</div><div class="provider-meta"><span>وضعیت</span><strong>${p.is_enabled ? 'فعال' : 'غیرفعال'}</strong></div><div class="provider-meta"><span>Sender</span><strong>${esc(p.sender_number || 'تنظیم نشده')}</strong></div></article>`;
  }

  async function loadProviders() {
    try { const d = await api('/api/admin/sms/providers'); $('#providersList').innerHTML = (d.providers || []).map(p => `<article class="provider-card editable"><div class="provider-head"><div><span class="provider-name">${esc(p.name)}</span><small>${esc(p.provider_key)}</small></div>${p.is_default ? '<span class="default-badge">Default</span>' : ''}</div><label>شماره فرستنده<input data-sender="${p.id}" value="${esc(p.sender_number || '')}" placeholder="شماره ارسال"></label><div class="provider-actions"><label class="switch"><input type="checkbox" data-enabled="${p.id}" ${p.is_enabled ? 'checked' : ''}><span>فعال</span></label><button class="admin-button primary small" data-save-provider="${p.id}">ذخیره</button>${p.is_default ? '' : `<button class="admin-button outline small" data-default-provider="${p.id}">انتخاب Default</button>`}</div></article>`).join('') || empty('Providerها هنوز در D1 ساخته نشده‌اند.');
      bindProviderActions();
    } catch(e) { showMessage(e.message, 'error'); }
  }

  function bindProviderActions() {
    $$('[data-save-provider]').forEach(b => b.onclick = async () => { try { const id=b.dataset.saveProvider; await api('/api/admin/sms/providers',{method:'POST',body:JSON.stringify({id,senderNumber:$(`[data-sender="${id}"]`).value,enabled:$(`[data-enabled="${id}"]`).checked})}); showMessage('تنظیمات Provider ذخیره شد.','success'); loadProviders(); } catch(e){showMessage(e.message,'error');} });
    $$('[data-default-provider]').forEach(b => b.onclick = async () => { try { await api('/api/admin/sms/providers',{method:'POST',body:JSON.stringify({id:b.dataset.defaultProvider,isDefault:true})}); showMessage('Provider پیش‌فرض تغییر کرد.','success'); loadProviders(); } catch(e){showMessage(e.message,'error');} });
  }

  async function loadTemplates() {
    try { const d=await api('/api/admin/sms/templates'); $('#templatesList').innerHTML=(d.templates||[]).map(t=>`<article class="template-card"><div class="template-head"><div><strong>${esc(t.provider_name)} — ${esc(purposeLabel(t.purpose))}</strong><small>${esc(t.name)}</small></div>${t.is_enabled ? '<span class="sms-status sent">فعال</span>' : '<span class="sms-status failed">غیرفعال</span>'}</div><div class="template-fields"><label>Template ID / Ref<input data-ref="${t.id}" value="${esc(t.template_ref || '')}" placeholder="برای Provider مربوطه"></label><label>متن Template<textarea data-message="${t.id}" rows="4" placeholder="متن مخصوص همین Provider">${esc(t.message_text || '')}</textarea></label></div><div class="provider-actions"><label class="switch"><input type="checkbox" data-template-enabled="${t.id}" ${t.is_enabled ? 'checked' : ''}><span>فعال</span></label><button class="admin-button primary small" data-save-template="${t.id}">ذخیره Template</button></div></article>`).join('') || empty('Templateها هنوز در D1 ساخته نشده‌اند.');
      $$('[data-save-template]').forEach(b=>b.onclick=async()=>{try{const id=b.dataset.saveTemplate;await api('/api/admin/sms/templates',{method:'POST',body:JSON.stringify({id,templateRef:$(`[data-ref="${id}"]`).value,messageText:$(`[data-message="${id}"]`).value,enabled:$(`[data-template-enabled="${id}"]`).checked})});showMessage('Template ذخیره شد.','success');loadTemplates();}catch(e){showMessage(e.message,'error')}});
    } catch(e) { showMessage(e.message,'error'); }
  }

  async function loadLogs() {
    try { const q=new URLSearchParams(); if($('#logProvider').value)q.set('provider',$('#logProvider').value); if($('#logStatus').value)q.set('status',$('#logStatus').value); q.set('limit','100'); const d=await api(`/api/admin/sms/logs?${q}`); $('#logsTable').innerHTML=logsTable(d.logs||[],false); } catch(e){showMessage(e.message,'error');}
  }

  function logsTable(rows, compact) {
    if (!rows.length) return empty('هنوز لاگی ثبت نشده است.');
    return `<table class="admin-table"><thead><tr><th>زمان</th><th>Provider</th><th>نوع</th><th>مقصد</th><th>ارسال</th><th>Delivery</th>${compact ? '' : '<th>کد Provider</th><th>Message ID</th><th>خطا / پاسخ</th>'}</tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.created_at)}</td><td>${esc(r.provider_name)}</td><td>${esc(purposeLabel(r.purpose))}</td><td dir="ltr">${esc(r.recipient)}</td><td>${status(r.send_status)}</td><td>${status(r.delivery_status)}</td>${compact ? '' : `<td>${esc(r.provider_code || '—')}</td><td dir="ltr">${esc(r.provider_message_id || '—')}</td><td><details><summary>${esc(r.error_message || 'مشاهده پاسخ')}</summary><pre>${esc(r.provider_response || r.message || '—')}</pre></details></td>`}</tr>`).join('')}</tbody></table>`;
  }

  function empty(text) { return `<div class="sms-empty">${esc(text)}</div>`; }

  document.addEventListener('DOMContentLoaded', () => {
    if (!location.pathname.startsWith('/admin/sms')) return;
    $$('.sms-tab').forEach(b=>b.onclick=()=>activateTab(b.dataset.tab));
    $$('[data-go-tab]').forEach(b=>b.onclick=()=>activateTab(b.dataset.goTab));
    $('#refreshLogs')?.addEventListener('click',loadLogs); $('#logProvider')?.addEventListener('change',loadLogs); $('#logStatus')?.addEventListener('change',loadLogs);
    const originalFetch = window.fetch;
    // admin.js already authenticates the session on dashboard pages; this page uses the same cookie-backed session.
    api('/api/admin/me').then(d=>{ if(d.admin && $('#adminName')) $('#adminName').textContent=d.admin.fullName || d.admin.email; }).catch(()=>{});
    loadOverview();
  });
})();
