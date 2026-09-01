(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  const num = v => new Intl.NumberFormat('fa-IR').format(Math.round(Number(v) || 0));
  const pct = v => `${Number(v || 0).toFixed(1)}%`;
  let days = 30;

  function styles() {
    if ($('#googleSearchRuntimeStyles')) return;
    const s = document.createElement('style'); s.id = 'googleSearchRuntimeStyles';
    s.textContent = `.google-search-card{margin-top:14px;padding:18px;border:1px solid #e5e9f0;border-radius:14px;background:#fff}.google-search-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.google-search-controls{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.google-search-controls select{padding:8px 10px;border:1px solid #d0d5dd;border-radius:9px;background:#fff;font:inherit}.google-search-status{margin-top:12px;padding:11px 13px;border-radius:10px;font-size:11px;line-height:1.8}.google-search-ok{background:#ecfdf3;color:#027a48}.google-search-error{background:#fef3f2;color:#b42318}.google-search-muted{background:#f8fafc;color:#667085}.google-search-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}.google-search-metric{padding:14px;border:1px solid #e5e9f0;border-radius:12px;background:#fff}.google-search-metric span{display:block;font-size:11px;color:#667085;margin-bottom:5px}.google-search-metric strong{font-size:20px}.google-search-chart{height:210px;padding:14px;border:1px solid #e5e9f0;border-radius:12px;background:#fff;display:flex;align-items:flex-end;gap:5px;overflow:hidden}.google-search-bar{flex:1;min-width:5px;background:#2563eb;border-radius:4px 4px 0 0}.google-search-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}.google-search-panel{padding:14px;border:1px solid #e5e9f0;border-radius:12px;background:#fff}.google-search-panel h4{margin:0 0 10px;font-size:13px}.google-search-row{display:flex;justify-content:space-between;gap:10px;padding:9px 10px;background:#f8fafc;border-radius:8px;font-size:11px;margin-top:6px}.google-search-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.google-search-empty{padding:20px;text-align:center;color:#667085;background:#f8fafc;border-radius:10px;font-size:11px}.google-search-table{width:100%;border-collapse:collapse;font-size:11px}.google-search-table th,.google-search-table td{padding:8px;border-bottom:1px solid #eef0f3;text-align:right}.google-search-meta{margin-top:10px;color:#667085;font-size:10px}@media(max-width:800px){.google-search-metrics{grid-template-columns:1fr 1fr}.google-search-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(s);
  }

  function insertCard() {
    const section = $('#analytics');
    if (!section || $('#googleSearchConsoleCard')) return Boolean(section);
    const bing = section.querySelector('.bing-live-card');
    const card = document.createElement('div');
    card.id = 'googleSearchConsoleCard'; card.className = 'sms-section-card google-search-card';
    card.innerHTML = `<div class="google-search-head"><div><h3 style="margin:0 0 5px">Google Search Console</h3><div style="font-size:11px;color:#667085">داده واقعی Search Analytics سایت payamake.ir داخل پنل.</div></div><div class="google-search-controls"><select id="googleSearchDays"><option value="1">امروز</option><option value="2">دیروز</option><option value="7">۷ روز</option><option value="30" selected>۳۰ روز</option><option value="90">۹۰ روز</option><button id="googleSearchRefresh" class="admin-button outline small" type="button">بروزرسانی</button></div></div><div id="googleSearchStatus" class="google-search-status google-search-muted">در حال بررسی اتصال...</div><div id="googleSearchData" style="display:none"><div class="google-search-metrics" id="googleSearchMetrics"></div><div><strong style="font-size:13px">روند کلیک و نمایش Google</strong><div id="googleSearchChart" style="margin-top:8px"></div></div><div class="google-search-grid"><div class="google-search-panel"><h4>کلمات کلیدی برتر</h4><div id="googleSearchQueries"></div></div><div class="google-search-panel"><h4>صفحات برتر</h4><div id="googleSearchPages"></div></div><div class="google-search-panel"><h4>کشورها</h4><div id="googleSearchCountries"></div></div><div class="google-search-panel"><h4>دستگاه‌ها</h4><div id="googleSearchDevices"></div></div></div><div id="googleSearchUpdated" class="google-search-meta"></div></div>`;
    if (bing) bing.insertAdjacentElement('afterend', card); else section.appendChild(card);
    $('#googleSearchRefresh').addEventListener('click', load);
    $('#googleSearchDays').addEventListener('change', e => { days = Number(e.target.value) || 30; load(); });
    return true;
  }

  function renderList(target, rows, key) {
    const box = $(target); if (!box) return;
    const data = (rows || []).slice(0, 10);
    box.innerHTML = data.length ? data.map(r => `<div class="google-search-row"><span>${esc(r[key])}</span><strong>${num(r.clicks)}</strong></div>`).join('') : '<div class="google-search-empty">داده‌ای موجود نیست.</div>';
  }

  function render(data) {
    const s = data.summary || {};
    $('#googleSearchMetrics').innerHTML = [['کلیک',num(s.clicks)],['نمایش',num(s.impressions)],['CTR',pct(s.ctr)],['میانگین رتبه',Number(s.position || 0).toFixed(1)]].map(x => `<div class="google-search-metric"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
    const series = data.series || [];
    if (!series.length) $('#googleSearchChart').innerHTML = '<div class="google-search-empty">هنوز داده‌ای برای این بازه در Search Console موجود نیست.</div>';
    else { const max = Math.max(1, ...series.map(x => Number(x.impressions) || 0)); $('#googleSearchChart').innerHTML = `<div class="google-search-chart">${series.slice(-60).map(x => `<div class="google-search-bar" style="height:${Math.max(3, (Number(x.impressions)||0) / max * 100)}%" title="${esc(x.date)} — ${num(x.impressions)} نمایش"></div>`).join('')}</div>`; }
    renderList('#googleSearchQueries', data.queries, 'query');
    renderList('#googleSearchPages', data.pages, 'page');
    renderList('#googleSearchCountries', data.countries, 'country');
    renderList('#googleSearchDevices', data.devices, 'device');
    $('#googleSearchUpdated').textContent = `بازه داده: ${data.startDate} تا ${data.endDate} · بروزرسانی پنل: ${new Date().toLocaleString('fa-IR')}`;
  }

  async function status() {
    const box = $('#googleSearchStatus'); if (!box) return null;
    try {
      const r = await fetch('/api/admin/analytics/google/status', { credentials:'include', cache:'no-store' });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.error || 'خطا در بررسی اتصال Google.');
      if (!d.connected) { box.className='google-search-status google-search-muted'; box.innerHTML='اتصال Google Search Console هنوز انجام نشده است. <button id="googleSearchConnect" class="admin-button primary small" type="button">اتصال Google Search Console</button>'; $('#googleSearchConnect').addEventListener('click', () => { location.href='/api/admin/analytics/google/connect'; }); $('#googleSearchData').style.display='none'; return false; }
      box.className='google-search-status google-search-ok'; box.textContent=`متصل به Google Search Console · Property: ${d.siteUrl || 'https://payamake.ir/'}`; return true;
    } catch (e) { box.className='google-search-status google-search-error'; box.textContent=e.message || 'خطا در بررسی اتصال Google.'; $('#googleSearchData').style.display='none'; return false; }
  }

  async function load() {
    const connected = await status(); if (!connected) return;
    const button = $('#googleSearchRefresh'); if (button) { button.disabled=true; button.textContent='در حال دریافت...'; }
    try {
      const r = await fetch(`/api/admin/analytics/google/data?days=${days}`, { credentials:'include', cache:'no-store' });
      const d = await r.json(); if (!r.ok || !d.success) throw new Error(d.error || 'دریافت آمار Google Search Console انجام نشد.');
      render(d); $('#googleSearchData').style.display='block';
    } catch (e) { const box=$('#googleSearchStatus'); box.className='google-search-status google-search-error'; box.textContent=e.message || 'خطا در دریافت داده Google.'; $('#googleSearchData').style.display='none'; }
    finally { if (button) { button.disabled=false; button.textContent='بروزرسانی'; } }
  }

  function boot() {
    if (!location.pathname.startsWith('/admin')) return;
    styles(); let tries=0;
    const timer=setInterval(() => { if (insertCard() || ++tries >= 160) { clearInterval(timer); if ($('#googleSearchConsoleCard')) load(); } }, 250);
    insertCard();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
