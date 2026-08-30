(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));

  function injectStyles() {
    if ($('#adminAnalyticsRuntimeStyles')) return;
    const style = document.createElement('style');
    style.id = 'adminAnalyticsRuntimeStyles';
    style.textContent = `
      .analytics-source-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:16px}
      .analytics-source{display:flex;flex-direction:column;gap:12px;padding:18px;border:1px solid #e5e9f0;border-radius:14px;background:#fff;box-sizing:border-box}
      .analytics-source-head{display:flex;align-items:center;gap:10px}.analytics-source-icon{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:#f2f4f7;font-weight:900}.analytics-source h3{margin:0;font-size:14px}.analytics-source p{margin:0;color:#667085;font-size:12px;line-height:1.8}.analytics-source-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:auto}.analytics-source-actions a{display:inline-flex;align-items:center;justify-content:center;padding:8px 11px;border-radius:9px;border:1px solid #d0d5dd;background:#fff;color:#344054;text-decoration:none;font:inherit;font-size:12px}.analytics-source-actions a.primary{background:#2563eb;border-color:#2563eb;color:#fff}
      .seo-check-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px}.seo-check{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 14px;border:1px solid #e5e9f0;border-radius:11px;background:#fff}.seo-check strong{font-size:12px}.seo-check small{display:block;color:#667085;font-size:11px;margin-top:4px}.seo-check-badge{padding:5px 9px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap}.seo-ok{background:#ecfdf3;color:#027a48}.seo-warn{background:#fffaeb;color:#b54708}.seo-error{background:#fef3f2;color:#b42318}.analytics-note{margin-top:12px;padding:12px 14px;border-radius:10px;background:#f8fafc;color:#667085;font-size:11px;line-height:1.8}.analytics-updated{margin-top:10px;color:#667085;font-size:11px}
      @media(max-width:800px){.analytics-source-grid,.seo-check-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function render() {
    const section = $('#analytics');
    if (!section || section.dataset.analyticsReady === '1') return;
    section.dataset.analyticsReady = '1';
    injectStyles();
    section.innerHTML = `
      <div class="section-heading"><h2>تحلیل و SEO</h2><span>مرکز گزارش و پایش عملکرد سایت</span></div>
      <div class="sms-section-card">
        <div class="sms-section-title"><div><h3>منابع آمار</h3><span>سه منبع اصلی آمار PAYAMAKE از همین‌جا در دسترس هستند.</span></div><button id="refreshSeoChecks" class="admin-button outline small" type="button">بررسی مجدد SEO</button></div>
        <div class="analytics-source-grid">
          <article class="analytics-source"><div class="analytics-source-head"><div class="analytics-source-icon">CF</div><div><h3>Cloudflare Analytics</h3></div></div><p>آمار ترافیک، Requests، خطاها، Performance و Workers از داشبورد Cloudflare.</p><div class="analytics-source-actions"><a class="primary" href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer">باز کردن Cloudflare</a><a href="https://developers.cloudflare.com/analytics/" target="_blank" rel="noopener noreferrer">راهنما</a></div></article>
          <article class="analytics-source"><div class="analytics-source-head"><div class="analytics-source-icon">G</div><div><h3>Google Search Console</h3></div></div><p>Performance جستجو، Queryها، Pages، Indexing و وضعیت دیده‌شدن در Google.</p><div class="analytics-source-actions"><a class="primary" href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">باز کردن Search Console</a><a href="https://developers.google.com/webmaster-tools/v1/searchanalytics/query" target="_blank" rel="noopener noreferrer">API</a></div></article>
          <article class="analytics-source"><div class="analytics-source-head"><div class="analytics-source-icon">B</div><div><h3>Bing Webmaster</h3></div></div><p>Rank & Traffic، Keyword، Crawl و وضعیت ایندکس سایت در Bing.</p><div class="analytics-source-actions"><a class="primary" href="https://www.bing.com/webmasters" target="_blank" rel="noopener noreferrer">باز کردن Bing Webmaster</a><a href="https://learn.microsoft.com/en-us/bingwebmaster/" target="_blank" rel="noopener noreferrer">API</a></div></article>
        </div>
        <div class="analytics-note">فعلاً هیچ API Key، OAuth Token یا Credential جدیدی داخل کد قرار نگرفته است. این بخش منابع واقعی شما را یکجا در پنل قرار می‌دهد؛ اتصال داده زنده را می‌توان بعد از تعیین Credential امن هر سرویس اضافه کرد.</div>
      </div>
      <div class="sms-section-card">
        <div class="sms-section-title"><div><h3>سلامت پایه SEO</h3><span>بررسی مستقیم فایل‌ها و سیگنال‌های فنی سایت.</span></div></div>
        <div id="seoChecks" class="seo-check-grid"><div class="sms-loading">در حال بررسی...</div></div>
        <div id="seoUpdated" class="analytics-updated"></div>
      </div>
    `;
    $('#refreshSeoChecks')?.addEventListener('click', () => checkSeo(true));
    checkSeo(false);
  }

  async function check(path) {
    try { const r = await fetch(path, { cache: 'no-store' }); return { ok: r.ok, status: r.status }; }
    catch { return { ok: false, status: 0 }; }
  }

  async function checkSeo(notify) {
    const box = $('#seoChecks'); if (!box) return;
    box.innerHTML = '<div class="sms-loading">در حال بررسی...</div>';
    const [robots, sitemap] = await Promise.all([check('/robots.txt'), check('/sitemap.xml')]);
    const canonical = !!document.querySelector('link[rel="canonical"]');
    const description = !!document.querySelector('meta[name="description"]');
    const og = !!document.querySelector('meta[property="og:title"]');
    const results = [
      ['robots.txt', robots.ok, robots.ok ? 'قابل دسترسی' : `HTTP ${robots.status || 'خطا'}`],
      ['sitemap.xml', sitemap.ok, sitemap.ok ? 'قابل دسترسی' : `HTTP ${sitemap.status || 'خطا'}`],
      ['Canonical', canonical, canonical ? 'وجود دارد' : 'یافت نشد'],
      ['Meta description', description, description ? 'وجود دارد' : 'یافت نشد'],
      ['Open Graph', og, og ? 'وجود دارد' : 'یافت نشد']
    ];
    box.innerHTML = results.map(([name, ok, detail]) => `<article class="seo-check"><div><strong>${esc(name)}</strong><small>${esc(detail)}</small></div><span class="seo-check-badge ${ok ? 'seo-ok' : 'seo-error'}">${ok ? 'سالم' : 'نیازمند بررسی'}</span></article>`).join('');
    $('#seoUpdated').textContent = `آخرین بررسی: ${new Date().toLocaleString('fa-IR')}`;
    if (notify) {
      const event = new CustomEvent('payamake:toast', { detail: { text: 'بررسی پایه SEO انجام شد.' } });
      document.dispatchEvent(event);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (location.pathname !== '/admin/' && location.pathname !== '/admin/index.html') return;
    render();
  });
  window.initPayamakeAnalytics = render;
})();
