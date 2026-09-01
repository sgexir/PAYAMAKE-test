(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  const num = (v) => new Intl.NumberFormat('fa-IR').format(Math.round(Number(v) || 0));
  let days = 30;

  function addStyles() {
    if ($('#siteTrafficAnalyticsStyles')) return;
    const style = document.createElement('style');
    style.id = 'siteTrafficAnalyticsStyles';
    style.textContent = `
      .site-traffic-card{margin-top:14px!important}.site-traffic-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:14px 0}.site-traffic-ranges{display:flex;gap:6px;flex-wrap:wrap}.site-traffic-ranges button{border:1px solid #d0d5dd;background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;font:inherit;font-size:12px}.site-traffic-ranges button.active{background:#2563eb;color:#fff;border-color:#2563eb}.site-traffic-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.site-traffic-stat{padding:16px;border:1px solid #e5e9f0;border-radius:12px;background:#fff}.site-traffic-stat span{display:block;font-size:11px;color:#667085;margin-bottom:6px}.site-traffic-stat strong{font-size:24px}.site-traffic-chart{margin-top:12px;padding:14px;border:1px solid #e5e9f0;border-radius:12px;background:#fff}.site-traffic-chart h4{margin:0 0 10px;font-size:13px}.site-traffic-line{fill:none;stroke:#2563eb;stroke-width:2.5}.site-traffic-grid{stroke:#e5e7eb;stroke-width:1}.site-traffic-label{font-size:10px;fill:#667085}.site-traffic-loading{padding:24px;text-align:center;color:#667085}.site-traffic-error{padding:14px;border-radius:10px;background:#fef2f2;color:#991b1b;font-size:12px;line-height:1.9}.site-traffic-meta{font-size:11px;color:#667085;margin-top:10px}.site-traffic-note{margin-top:10px;padding:11px 13px;border-radius:10px;background:#f8fafc;color:#667085;font-size:11px;line-height:1.8}@media(max-width:600px){.site-traffic-summary{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function chart(series) {
    if (!series.length) return '<div class="site-traffic-loading">هنوز داده‌ای برای این بازه وجود ندارد.</div>';
    const values = series.map((x) => Number(x.pageViews) || 0);
    const W = 760, H = 190, P = 24, max = Math.max(...values, 1);
    const points = values.map((v, i) => {
      const x = P + (i / Math.max(values.length - 1, 1)) * (W - P * 2);
      const y = H - P - (v / max) * (H - P * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg viewBox="0 0 760 190" preserveAspectRatio="none" style="display:block;width:100%;height:190px"><line x1="24" y1="24" x2="736" y2="24" class="site-traffic-grid"/><line x1="24" y1="95" x2="736" y2="95" class="site-traffic-grid"/><line x1="24" y1="166" x2="736" y2="166" class="site-traffic-grid"/><polyline points="${points}" class="site-traffic-line"/><text x="24" y="184" class="site-traffic-label">${esc(series[0].date)}</text><text x="736" y="184" text-anchor="end" class="site-traffic-label">${esc(series[series.length - 1].date)}</text></svg>`;
  }

  async function load(card) {
    const box = $('#siteTrafficContent', card);
    if (!box) return;
    box.innerHTML = '<div class="site-traffic-loading">در حال دریافت آمار واقعی بازدید سایت...</div>';
    try {
      const response = await fetch(`/api/admin/analytics/cloudflare/web/data?days=${days}`, { credentials:'include', cache:'no-store' });
      const data = await response.json().catch(() => ({ success:false, error:'پاسخ نامعتبر از API' }));
      if (!response.ok || !data.success) throw new Error(data.error || `خطای API (${response.status})`);
      const summary = data.summary || {};
      const series = Array.isArray(data.series) ? data.series : [];
      box.innerHTML = `<div class="site-traffic-summary"><div class="site-traffic-stat"><span>بازدید صفحات (Page Views)</span><strong>${num(summary.pageViews)}</strong></div><div class="site-traffic-stat"><span>بازدیدکننده / Visit</span><strong>${num(summary.visits)}</strong></div></div><div class="site-traffic-chart"><h4>روند بازدید صفحات</h4>${chart(series)}</div><div class="site-traffic-note">این بخش ترافیک واقعی کاربران سایت را از Cloudflare HTTP Analytics (Eyeball Traffic) نمایش می‌دهد؛ با آمار Worker اشتباه نشود.</div><div class="site-traffic-meta">سایت: ${esc(data.site || 'payamake.ir')} · منبع: Cloudflare HTTP Analytics · بروزرسانی: ${new Date().toLocaleString('fa-IR')}</div>`;
    } catch (error) {
      box.innerHTML = `<div class="site-traffic-error"><strong>دریافت آمار بازدید سایت ناموفق بود.</strong><br>${esc(error?.message || 'خطای نامشخص')}</div>`;
    }
  }

  function inject() {
    const section = $('#analytics');
    if (!section || section.dataset.analyticsReady !== '1') return false;
    if ($('#siteTrafficAnalyticsCard')) return true;
    addStyles();
    const card = document.createElement('div');
    card.id = 'siteTrafficAnalyticsCard';
    card.className = 'sms-section-card site-traffic-card';
    card.innerHTML = '<div class="sms-section-title"><div><h3>بازدید و ترافیک واقعی سایت</h3><span>آمار بازدیدکنندگان و Page Views سایت PAYAMAKE، جدا از آمار Worker.</span></div><button id="siteTrafficRefresh" class="admin-button outline small" type="button">بروزرسانی</button></div><div class="site-traffic-toolbar"><div class="site-traffic-ranges"><button data-site-days="7" type="button">۷ روز</button><button data-site-days="30" class="active" type="button">۳۰ روز</button><button data-site-days="90" type="button">۹۰ روز</button></div><span>ترافیک واقعی سایت</span></div><div id="siteTrafficContent" class="site-traffic-loading">در حال آماده‌سازی...</div>';
    section.appendChild(card);
    card.querySelectorAll('[data-site-days]').forEach((button) => button.addEventListener('click', () => {
      days = Number(button.dataset.siteDays) || 30;
      card.querySelectorAll('[data-site-days]').forEach((x) => x.classList.toggle('active', x === button));
      load(card);
    }));
    $('#siteTrafficRefresh', card)?.addEventListener('click', () => load(card));
    load(card);
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
