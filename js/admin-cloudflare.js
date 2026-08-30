(() => {
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  const api = path => fetch(path, { credentials:'include', cache:'no-store' }).then(async r => {
    const d = await r.json().catch(() => ({ success:false, error:'پاسخ نامعتبر از سرور' }));
    if (r.status === 401) throw new Error('احراز هویت لازم است.');
    if (!r.ok || d.success === false) throw new Error(d.error || `خطای سرور (${r.status})`);
    return d;
  });

  function styles() {
    if ($('#cfAnalyticsRuntimeStyles')) return;
    const s = document.createElement('style');
    s.id = 'cfAnalyticsRuntimeStyles';
    s.textContent = `
      .cf-runtime-card{margin:0 0 16px!important;position:relative}
      .cf-runtime-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:14px 0}
      .cf-runtime-ranges{display:flex;gap:6px;flex-wrap:wrap}
      .cf-runtime-ranges button{border:1px solid #d0d5dd;background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;font:inherit;font-size:12px}
      .cf-runtime-ranges button.active{background:#2563eb;color:#fff;border-color:#2563eb}
      .cf-runtime-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
      .cf-runtime-stat{padding:14px;border:1px solid #e5e9f0;border-radius:12px;background:#fff}
      .cf-runtime-stat span{display:block;font-size:11px;color:#667085;margin-bottom:6px}
      .cf-runtime-stat strong{font-size:20px}
      .cf-runtime-chart{margin-top:14px;padding:16px;border:1px solid #e5e9f0;border-radius:14px;background:#fff}
      .cf-runtime-chart h4{margin:0 0 12px;font-size:13px}
      .cf-runtime-chart svg{width:100%;height:210px;display:block}
      .cf-runtime-line{fill:none;stroke:#2563eb;stroke-width:2.5}
      .cf-runtime-error-line{fill:none;stroke:#dc2626;stroke-width:2.5}
      .cf-runtime-grid{stroke:#e5e7eb;stroke-width:1}
      .cf-runtime-label{font-size:10px;fill:#667085}
      .cf-runtime-loading{padding:28px;text-align:center;color:#667085}
      .cf-runtime-error{padding:14px;border-radius:10px;background:#fef2f2;color:#991b1b;font-size:12px;line-height:1.9}
      .cf-runtime-meta{font-size:11px;color:#667085;margin-top:10px}
      .cf-runtime-source{padding:8px 10px;border-radius:8px;background:#f8fafc;color:#475467;font-size:11px}
      @media(max-width:800px){.cf-runtime-summary{grid-template-columns:1fr 1fr}.cf-runtime-summary .cf-runtime-stat:last-child{grid-column:1/-1}}
    `;
    document.head.appendChild(s);
  }

  function cleanupLegacyAnalytics() {
    const section = $('#analytics');
    if (!section) return;
    section.querySelectorAll('.feature-card').forEach(card => {
      const text = card.textContent || '';
      if (text.includes('داشبورد تجمیعی آمار در مرحله بعد متصل می‌شود') || text.includes('شاخص‌های SEO و Search Console در مرحله بعد اضافه می‌شوند')) card.remove();
    });
  }

  function svg(series, key, cls) {
    const vals = series.map(x => Number(x[key]) || 0);
    if (!vals.length) return '<div class="cf-runtime-loading">داده‌ای برای این بازه وجود ندارد.</div>';
    const W=760,H=210,P=28,max=Math.max(...vals,1),min=Math.min(...vals,0),range=max-min||1;
    const pts=vals.map((v,i)=>{const x=P+(i/Math.max(vals.length-1,1))*(W-P*2);const y=H-P-((v-min)/range)*(H-P*2);return `${x.toFixed(1)},${y.toFixed(1)}`}).join(' ');
    const grid=[0,1,2,3,4].map(i=>{const y=P+i*(H-P*2)/4;return `<line x1="${P}" y1="${y}" x2="${W-P}" y2="${y}" class="cf-runtime-grid"/>`}).join('');
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${grid}<polyline points="${pts}" class="${cls}"/><text x="${P}" y="${H-6}" class="cf-runtime-label">${esc(series[0]?.date||'')}</text><text x="${W-P}" y="${H-6}" text-anchor="end" class="cf-runtime-label">${esc(series.at(-1)?.date||'')}</text></svg>`;
  }

  const num = v => new Intl.NumberFormat('fa-IR').format(Math.round(Number(v)||0));
  const pct = v => `${(Number(v)||0).toFixed(2)}٪`;
  let days = 30;

  async function load(notify=false) {
    const box = $('#cfAnalyticsContent');
    if (!box) return;
    box.innerHTML = '<div class="cf-runtime-loading">در حال دریافت آمار واقعی Cloudflare...</div>';
    try {
      const d = await api(`/api/admin/analytics/cloudflare/data?days=${days}`);
      const s=d.summary||{}, series=Array.isArray(d.series)?d.series:[];
      box.innerHTML = `
        <div class="cf-runtime-summary">
          <div class="cf-runtime-stat"><span>درخواست‌ها</span><strong>${num(s.requests)}</strong></div>
          <div class="cf-runtime-stat"><span>خطاها</span><strong>${num(s.errors)}</strong></div>
          <div class="cf-runtime-stat"><span>نرخ خطا</span><strong>${pct(s.errorRate)}</strong></div>
          <div class="cf-runtime-stat"><span>Subrequests</span><strong>${num(s.subrequests)}</strong></div>
          <div class="cf-runtime-stat"><span>CPU P99</span><strong>${num(s.cpuP99)} ms</strong></div>
        </div>
        <div class="cf-runtime-chart"><h4>روند درخواست‌ها</h4>${svg(series,'requests','cf-runtime-line')}</div>
        <div class="cf-runtime-chart"><h4>روند نرخ خطا</h4>${svg(series,'errorRate','cf-runtime-error-line')}</div>
        <div class="cf-runtime-meta">Worker: ${esc(d.worker||'—')} · منبع: ${esc(d.source||'Cloudflare Analytics')} · بروزرسانی: ${new Date().toLocaleString('fa-IR')}</div>`;
      if (notify && window.monitoringToast) window.monitoringToast('آمار Cloudflare بروزرسانی شد.');
    } catch(e) {
      box.innerHTML = `<div class="cf-runtime-error"><strong>دریافت آمار Cloudflare ناموفق بود.</strong><br>${esc(e.message)}<br><small>خود کارت فعال است؛ خطای واقعی API در بالا نمایش داده شده است.</small></div>`;
    }
  }

  function inject() {
    const section = $('#analytics');
    if (!section) return false;
    styles();
    cleanupLegacyAnalytics();
    let card = $('#cloudflareAnalyticsCard');
    if (!card) {
      card=document.createElement('div');
      card.id='cloudflareAnalyticsCard';
      card.className='sms-section-card cf-runtime-card';
      card.innerHTML=`
        <div class="sms-section-title">
          <div><h3>Cloudflare Analytics</h3><span>آمار آنلاین واقعی Cloudflare داخل پنل PAYAMAKE.</span></div>
          <button id="cfAnalyticsRefresh" class="admin-button outline small" type="button">بروزرسانی</button>
        </div>
        <div class="cf-runtime-toolbar">
          <div class="cf-runtime-ranges">
            <button data-days="7" type="button">۷ روز</button>
            <button data-days="30" class="active" type="button">۳۰ روز</button>
            <button data-days="90" type="button">۹۰ روز</button>
          </div>
          <span class="cf-runtime-source">داده واقعی Cloudflare</span>
        </div>
        <div id="cfAnalyticsContent" class="cf-runtime-loading">در حال آماده‌سازی...</div>`;
      section.insertBefore(card, section.firstElementChild || null);
      card.querySelectorAll('[data-days]').forEach(b=>b.onclick=()=>{days=Number(b.dataset.days);card.querySelectorAll('[data-days]').forEach(x=>x.classList.toggle('active',x===b));load();});
      $('#cfAnalyticsRefresh').onclick=()=>load(true);
      load();
    }
    return true;
  }

  function init() {
    if (location.pathname !== '/admin/' && location.pathname !== '/admin/index.html') return;
    let attempts=0;
    const tick=()=>{ attempts++; if(inject() || attempts>=20) return; setTimeout(tick,250); };
    tick();
    const observer=new MutationObserver(()=>{ if($('#analytics') && !$('#cloudflareAnalyticsCard')) inject(); });
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
  window.addEventListener('load', init, { once:true });
})();