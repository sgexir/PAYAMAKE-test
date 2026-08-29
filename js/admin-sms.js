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
  function setLoading(target, text = 'در حال بارگذاری...') { if (target) target.innerHTML = `<div class="sms-loading" role="status">${esc(text)}</div>`; }

  function activateTab(name) {
    $$('.sms-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $$('.sms-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
    if (name === 'overview') loadOverview();
    if (name === 'providers') loadProviders();
    if (name === 'templates') loadTemplates();
    if (name === 'logs') loadLogs();
  }

  async function loadOverview() {
    setLoading($('#smsStats'));
    try {
      const d = await api('/api/admin/sms/overview'), t = d.totals || {};
      $('#smsStats').innerHTML = [
        ['کل پیامک‌ها', t.total || 0], ['ارسال موفق', t.sent || 0], ['ناموفق', t.failed || 0], ['دلیور شده', t.delivered || 0], ['در انتظار دلیوری', t.delivery_pending || 0]
      ].map(x => `<article class="sms-stat"><span>${x[0]}</span><strong>${x[1]}</strong></article>`).join('');
      $('#providerSummary').innerHTML = (d.providers || []).map(providerCard).join('') || empty('هنوز Provider ثبت نشده است.');
      $('#recentLogs').innerHTML = logsTable(d.recent || [], true);
      showMessage(`آخرین وضعیت در ${new Date().toLocaleTimeString('fa-IR')} دریافت شد.`, 'success');
    } catch (e) { showMessage(e.message, 'error'); }
  }

  function providerIntegration(p) {
    const cls = p.integration_status === 'connected' ? 'provider-on' : p.integration_status === 'incomplete' ? 'provider-warning' : 'provider-off';
    return `<div class="provider-meta"><span>اتصال API</span><strong class="${cls}">${esc(p.integration_label || 'وضعیت نامشخص')}</strong></div><small class="provider-integration-detail">${esc(p.integration_detail || '')}</small>`;
  }

  function providerSender(p) {
    if (p.provider_key === 'sms_ir' && !p.sender_number) {
      return '<strong class="provider-neutral">از تنظیمات API / Template</strong>';
    }
    return `<strong dir="ltr">${esc(p.sender_number || 'تنظیم نشده')}</strong>`;
  }

  function providerCard(p) {
    const key = p.provider_key === 'sms_ir' ? 'SMS.ir' : p.provider_key === 'niazpardaz' ? 'Niazpardaz' : p.name;
    return `<article class="provider-card"><div class="provider-head"><div><span class="provider-name">${esc(key)}</span><small>${esc(p.provider_key)}</small></div>${p.is_default ? '<span class="default-badge">Default</span>' : ''}</div>${providerIntegration(p)}<div class="provider-meta"><span>وضعیت Provider</span><strong class="${p.is_enabled ? 'provider-on' : 'provider-off'}">${p.is_enabled ? 'فعال' : 'غیرفعال'}</strong></div><div class="provider-meta"><span>${p.provider_key === 'sms_ir' ? 'Sender / شماره فرستنده' : 'Sender'}</span>${providerSender(p)}</div></article>`;
  }

  async function loadProviders() {
    setLoading($('#providersList'));
    try {
      const d = await api('/api/admin/sms/providers');
      $('#providersList').innerHTML = (d.providers || []).map(p => `<article class="provider-card editable"><div class="provider-head"><div><span class="provider-name">${esc(p.name)}</span><small>${esc(p.provider_key)}</small></div>${p.is_default ? '<span class="default-badge">Default</span>' : ''}</div>${providerIntegration(p)}<label>شماره فرستنده${p.provider_key === 'sms_ir' ? '<small class="field-help">برای Verify Template الزامی نیست.</small>' : ''}<input dir="ltr" data-sender="${p.id}" value="${esc(p.sender_number || '')}" placeholder="${p.provider_key === 'sms_ir' ? 'اختیاری' : 'شماره ارسال'}"></label><div class="provider-actions"><label class="switch"><input type="checkbox" data-enabled="${p.id}" ${p.is_enabled ? 'checked' : ''}><span>فعال</span></label><button class="admin-button primary small" data-save-provider="${p.id}">ذخیره</button>${p.is_default ? '' : `<button class="admin-button outline small" data-default-provider="${p.id}">انتخاب Default</button>`}</div></article>`).join('') || empty('Providerها هنوز در D1 ساخته نشده‌اند.');
      bindProviderActions();
    } catch(e) { showMessage(e.message, 'error'); }
  }

  function bindProviderActions() {
    $$('[data-save-provider]').forEach(b => b.onclick = async () => {
      const id = b.dataset.saveProvider, enabled = $(`[data-enabled="${id}"]`).checked;
      b.disabled = true;
      try { await api('/api/admin/sms/providers',{method:'POST',body:JSON.stringify({id,senderNumber:$(`[data-sender="${id}"]`).value,enabled})}); showMessage('تنظیمات Provider ذخیره شد.','success'); await loadProviders(); await loadOverview(); }
      catch(e){showMessage(e.message,'error');} finally { b.disabled = false; }
    });
    $$('[data-default-provider]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { await api('/api/admin/sms/providers',{method:'POST',body:JSON.stringify({id:b.dataset.defaultProvider,isDefault:true})}); showMessage('Provider پیش‌فرض تغییر کرد.','success'); await loadProviders(); await loadOverview(); }
      catch(e){showMessage(e.message,'error');} finally { b.disabled = false; }
    });
  }

  async function loadTemplates() {
    setLoading($('#templatesList'));
    try {
      const d=await api('/api/admin/sms/templates');
      $('#templatesList').innerHTML=(d.templates||[]).map(t=>`<article class="template-card"><div class="template-head"><div><strong>${esc(t.provider_name)} — ${esc(purposeLabel(t.purpose))}</strong><small>${esc(t.name)}</small></div>${t.is_enabled ? '<span class="sms-status sent">فعال</span>' : '<span class="sms-status failed">غیرفعال</span>'}</div><div class="template-fields"><label>Template ID / Ref<input dir="ltr" data-ref="${t.id}" value="${esc(t.template_ref || '')}" placeholder="برای Provider مربوطه"></label><label>متن Template<textarea data-message="${t.id}" rows="4" placeholder="متن مخصوص همین Provider">${esc(t.message_text || '')}</textarea></label><label class="template-variables">Variables JSON<input dir="ltr" data-variables="${t.id}" value="${esc(t.variables_json || '[]')}" placeholder='["name","phone"]'><small>لیست متغیرهای مورد استفاده در Template</small></label></div><div class="provider-actions"><label class="switch"><input type="checkbox" data-template-enabled="${t.id}" ${t.is_enabled ? 'checked' : ''}><span>فعال</span></label><button class="admin-button primary small" data-save-template="${t.id}">ذخیره Template</button></div></article>`).join('') || empty('Templateها هنوز در D1 ساخته نشده‌اند.');
      $$('[data-save-template]').forEach(b=>b.onclick=async()=>{
        const id=b.dataset.saveTemplate; b.disabled=true;
        try { await api('/api/admin/sms/templates',{method:'POST',body:JSON.stringify({id,templateRef:$(`[data-ref="${id}"]`).value,messageText:$(`[data-message="${id}"]`).value,variablesJson:$(`[data-variables="${id}"]`).value,enabled:$(`[data-template-enabled="${id}"]`).checked})}); showMessage('Template ذخیره شد.','success'); await loadTemplates(); }
        catch(e){showMessage(e.message,'error');} finally { b.disabled=false; }
      });
    } catch(e) { showMessage(e.message, 'error'); }
  }

  async function loadLogs() {
    setLoading($('#logsTable'));
    try {
      const q = new URLSearchParams();
      if ($('#logProvider').value) q.set('provider', $('#logProvider').value);
      if ($('#logStatus').value) q.set('status', $('#logStatus').value);
      q.set('limit', '100');
      const d = await api(`/api/admin/sms/logs?${q}`);
      $('#logsTable').innerHTML = logsTable(d.logs || [], false);
      showMessage(`${(d.logs || []).length} لاگ نمایش داده شد.`, 'success');
    } catch(e) { showMessage(e.message, 'error'); }
  }

  function logsTable(rows, compact) {
    if (!rows.length) return empty('برای فیلتر فعلی لاگی ثبت نشده است.');
    return `<table class="admin-table sms-logs-table"><thead><tr><th>ID</th><th>زمان</th><th>Lead</th><th>Provider</th><th>نوع</th><th>مقصد</th><th>ارسال</th><th>Delivery</th>${compact ? '' : '<th>Template</th><th>Sender</th><th>Provider Code</th><th>Message ID</th><th>جزئیات</th>'}</tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.id)}</td><td>${esc(r.created_at)}</td><td>${esc(r.lead_id || '—')}</td><td>${esc(r.provider_name || r.provider_key)}</td><td>${esc(purposeLabel(r.purpose))}</td><td dir="ltr">${esc(r.recipient)}</td><td>${status(r.send_status)}</td><td>${status(r.delivery_status)}</td>${compact ? '' : `<td>${esc(r.template_id || '—')}</td><td dir="ltr">${esc(r.sender || '—')}</td><td dir="ltr">${esc(r.provider_code || r.provider_status || '—')}</td><td dir="ltr">${esc(r.provider_message_id || '—')}</td><td><details><summary>${r.error_message ? 'خطا' : 'مشاهده'}</summary><div class="sms-log-detail"><strong>${r.error_message ? 'خطا' : 'پاسخ Provider'}</strong><pre>${esc(r.error_message || r.provider_response || '—')}</pre>${r.message ? `<strong>پیام</strong><pre>${esc(r.message)}</pre>` : ''}</div></details></td>`}</tr>`).join('')}</tbody></table>`;
  }
  function empty(text) { return `<div class="sms-empty">${esc(text)}</div>`; }

  document.addEventListener('DOMContentLoaded', () => {
    const isControlCenter = location.pathname === '/admin/' || location.pathname === '/admin/index.html';
    if (!isControlCenter) return;
    $$('.sms-tab').forEach(b=>b.onclick=()=>activateTab(b.dataset.tab));
    $$('[data-go-tab]').forEach(b=>b.onclick=()=>activateTab(b.dataset.goTab));
    $('#refreshLogs')?.addEventListener('click',loadLogs);
    $('#logProvider')?.addEventListener('change',loadLogs);
    $('#logStatus')?.addEventListener('change',loadLogs);
    $('#refreshSmsOverview')?.addEventListener('click',loadOverview);
    loadOverview();
  });
})();
