(() => {
  'use strict';

  let days = 30;
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  const num = (v) => new Intl.NumberFormat('fa-IR').format(Math.round(Number(v) || 0));
  const pct = (v) => `${(Number(v) || 0).toFixed(2)}٪`;
  const cpu = (v) => `${Number(v || 0).toFixed(1)} µs`;
  const memory = (v) => { const n=Number(v)||0; if(n>=1073741824)return `${(n/1073741824).toFixed(1)} GB`; if(n>=1048576)return `${(n/1048576).toFixed(1)} MB`; if(n>=1024)return `${(n/1024).toFixed(1)} KB`; return `${Math.round(n)} B`; };

  function addStyles() {
    if ($('#cfAnalyticsRuntimeStyles')) return;
    const s = document.createElement('style');
    s.id = 'cfAnalyticsRuntimeStyles';
    s.textContent = '.cf-runtime-card{margin-top:14px!important}.cf-runtime-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:14px 0}.cf-runtime-ranges{display:flex;gap:6px;flex-wrap:wrap}.cf-runtime-ranges button{border:1px solid #d0d5dd;background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;font:inherit;font-size:12px}.cf-runtime-ranges button.active{background:#2563eb;color:#fff;border-color:#2563eb}.cf-runtime-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.cf-runtime-stat{padding:14px;border:1px solid #e5e9f0;border-radius:12px;background:#fff}.cf-runtime-stat span{display:block;font-size:11px;color:#667085;margin-bottom:6px}.cf-runtime-stat strong{font-size:20px}.cf-runtime-chart{margin-top:12px;padding:14px;border:1px solid #e5e9f0;border-radius:12px;background:#fff}.cf-runtime-chart h4{margin:0 0 10px;font-size:13px}.cf-runtime-loading{padding:24px;text-align:center;color:#667085}.cf-runtime-error{padding:14px;border-radius:10px;background:#fef2f2;color:#991b1b;font-size:12px;line-height:1.9}.cf-runtime-meta{font-size:11px;color:#667085;margin-top:10px}.cf-runtime-line{fill:none;stroke:#2563eb;stroke-width:2.5}.cf-runtime-error-line{fill:none;stroke:#dc2626;stroke-width:2.5}.cf-runtime-grid{stroke:#e5e7eb;stroke-width:1}.cf-runtime-label{font-size:10px;fill:#667085}@media(max-width:800px){.cf-runtime-summary{grid-template-columns:1fr 1fr}}';
    document.head.appendChild(s);
  }

  function makeChart(series, key, cls) {
    if (!series.length) return '<div class="cf-runtime-loading">داده‌ای برای این بازه وجود ندارد.</div>';
    const values = series.map((x) => Number(x[key]) || 0);
    const W = 760, H = 190, P = 24, max = Math.max(...values, 1);
    const points = values.map((v, i) => {
      const x = P + (i / Math.max(values.length - 1, 1)) * (W - P * 2);
      const y = H - P - (v / max) * (H - P * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return '<svg viewBox="0 0 760 190" preserveAspectRatio="none" style="display:block;width:100%;height:190px">' +
      '<line x1="24" y1="24" x2="736" y2="24" class="cf-runtime-grid"/><line x1="24" y1="95" x2="736" y2="95" class="cf-runtime-grid"/><line x1="24" y1="166" x2="736" y2="166" class="cf-runtime-grid"/>' +
      `<polyline points="${points}" class="${cls}"/>` +
      `<text x="24" y="184" class="cf-runtime-label">${esc(series[0].date)}</text>` +
      `<text x="736" y="184" text-anchor="end" class="cf-runtime-label">${esc(series[series.length - 1].date)}</text>` +
      '</svg>';
  }

  async function load() {
    const box = $('#cfAnalyticsContent');
    if (!box) return;
    box.innerHTML = '<div class="cf-runtime-loading">در حال دریافت آمار واقعی Cloudflare...</div>';
    try {
      const response = await fetch(`/api/admin/analytics/cloudflare/data?days=${days}`, { credentials:'include', cache:'no-store' });
      const data = await response.json().catch(() => ({ success:false, error:'پاسخ نامعتبر از API' }));
      if (!response.ok || !data.success) throw new Error(data.error || `خطای API (${response.status})`);
      const summary = data.summary || {};
      const series = Array.isArray(data.series) ? data.series : [];
      box.innerHTML = '<div class="cf-runtime-summary">' +
        `<div class="cf-runtime-stat"><span>درخواست‌ها</span><strong>${num(summary.requests)}</strong></div>` +
        `<div class="cf-runtime-stat"><span>خطاها</span><strong>${num(summary.errors)}</strong></div>` +
        `<div class="cf-runtime-stat"><span>نرخ خطا</span><strong>${pct(summary.errorRate)}</strong></div>` +
        `<div class="cf-runtime-stat"><span>Subrequests</span><strong>${num(summary.subrequests)}</strong></div>` +
        `<div class="cf-runtime-stat"><span>CPU P50</span><strong>${cpu(summary.cpuP50)}</strong></div>` +
        `<div class="cf-runtime-stat"><span>CPU P99</span><strong>${cpu(summary.cpuP99)}</strong></div>` +
        `<div class="cf-runtime-stat"><span>Memory P50</span><strong>${memory(summary.memoryP50)}</strong></div>` +
        `<div class="cf-runtime-stat"><span>Memory P99</span><strong>${memory(summary.memoryP99)}</strong></div>` +
        '</div>' +
        '<div class="cf-runtime-chart"><h4>روند درخواست‌ها</h4>' + makeChart(series, 'requests', 'cf-runtime-line') + '</div>' +
        '<div class="cf-runtime-chart"><h4>روند خطاها</h4>' + makeChart(series, 'errors', 'cf-runtime-error-line') + '</div>' +
        `<div class="cf-runtime-meta">Worker: ${esc(data.worker || '—')} · منبع: Cloudflare GraphQL Analytics API · بروزرسانی: ${new Date().toLocaleString('fa-IR')}</div>`;
    } catch (error) {
      box.innerHTML = `<div class="cf-runtime-error"><strong>دریافت آمار Cloudflare ناموفق بود.</strong><br>${esc(error?.message || 'خطای نامشخص')}</div>`;
    }
  }

  function inject() {
    const section = $('#analytics');
    if (!section) return false;
    if (section.dataset.analyticsReady !== '1') return false;
    addStyles();
    let card = $('#cloudflareAnalyticsCard');
    if (card) return true;
    card = document.createElement('div');
    card.id = 'cloudflareAnalyticsCard';
    card.className = 'sms-section-card cf-runtime-card';
    card.innerHTML = '<div class="sms-section-title"><div><h3>Cloudflare Analytics</h3><span>آمار آنلاین واقعی Cloudflare داخل پنل PAYAMAKE.</span></div><button id="cfAnalyticsRefresh" class="admin-button outline small" type="button">بروزرسانی</button></div>' +
      '<div class="cf-runtime-toolbar"><div class="cf-runtime-ranges">' +
      '<button data-cf-days="7" type="button">۷ روز</button><button data-cf-days="30" class="active" type="button">۳۰ روز</button><button data-cf-days="90" type="button">۹۰ روز</button>' +
      '</div><span>داده واقعی Cloudflare</span></div><div id="cfAnalyticsContent" class="cf-runtime-loading">در حال آماده‌سازی...</div>';
    section.appendChild(card);
    card.querySelectorAll('[data-cf-days]').forEach((button) => button.addEventListener('click', () => {
      days = Number(button.dataset.cfDays) || 30;
      card.querySelectorAll('[data-cf-days]').forEach((x) => x.classList.toggle('active', x === button));
      load();
    }));
    $('#cfAnalyticsRefresh')?.addEventListener('click', load);
    load();
    return true;
  }

  function init() {
    if (!location.pathname.startsWith('/admin')) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (inject() || tries >= 120) clearInterval(timer);
    }, 250);
    inject();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
