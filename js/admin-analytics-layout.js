(() => {
  'use strict';
  if (!location.pathname.startsWith('/admin')) return;

  const setup = () => {
    const section = document.querySelector('#analytics');
    if (!section) return false;

    const seo = section.querySelector('#seoChecks')?.closest('.sms-section-card');
    const site = section.querySelector('#siteTrafficAnalyticsCard');
    const cloudflare = section.querySelector('#cloudflareAnalyticsCard');
    const bingLive = section.querySelector('.bing-live-card');
    const sourceGrid = section.querySelector('.analytics-source-grid');
    const sourceCard = sourceGrid?.closest('.sms-section-card');

    if (!seo || !site || !cloudflare || !bingLive || !sourceGrid || !sourceCard) return false;

    const existingBingCard = section.querySelector('#bingAnalyticsCard');
    const bingConnection = sourceGrid.querySelector('#bingConnectAction')?.closest('.analytics-source');
    if (bingConnection) {
      const title = bingConnection.querySelector('h3');
      const text = bingConnection.querySelector('p');
      if (title) title.textContent = 'Google / Bing Search Analytics';
      if (text) text.textContent = 'اتصال مستقیم به Bing Webmaster برای نمایش آمار واقعی داخل پنل.';
    }

    let details = section.querySelector('.analytics-sources-details');
    if (!details) {
      details = document.createElement('details');
      details.className = 'sms-section-card analytics-sources-details';
      details.innerHTML = '<summary><span><strong>منابع آمار</strong><small>سه منبع اصلی آمار PAYAMAKE از همین‌جا در دسترس هستند.</small></span><span class="analytics-sources-chevron" aria-hidden="true">⌄</span></summary>';
      const body = document.createElement('div');
      body.className = 'analytics-sources-details-body';
      details.appendChild(body);
      const refresh = sourceCard.querySelector('#refreshSeoChecks');
      if (refresh) {
        const actions = document.createElement('div');
        actions.className = 'analytics-sources-actions';
        actions.appendChild(refresh);
        body.appendChild(actions);
      }
      body.appendChild(sourceGrid);
      sourceCard.remove();
      section.appendChild(details);
    }

    const body = details.querySelector('.analytics-sources-details-body');
    if (!body) return false;

    // The requested Bing connection panel belongs inside the bottom of Sources.
    let bingCard = existingBingCard || body.querySelector('#bingAnalyticsCard');
    if (!bingCard) {
      bingCard = document.createElement('div');
      bingCard.id = 'bingAnalyticsCard';
      bingCard.className = 'sms-section-card bing-analytics-card';
      bingCard.innerHTML = '<div class="sms-section-title"><div><h3>Google / Bing Search Analytics</h3><span>اتصال مستقیم به Bing Webmaster برای نمایش آمار واقعی داخل پنل.</span></div><button id="bingRefreshStatus" class="admin-button outline small" type="button">بروزرسانی</button></div><div class="bing-connect-row"><div id="bingStatus" class="bing-status"><span class="bing-dot"></span><span>در حال بررسی اتصال...</span></div><div class="bing-actions"><button id="bingConnect" class="admin-button primary small" type="button">اتصال Bing Webmaster</button><button id="bingDisconnect" class="admin-button outline small" type="button" style="display:none">قطع اتصال</button></div></div><div id="bingMessage"></div><div class="bing-help">پس از اتصال، مرحله بعد دریافت Rank، Traffic، Keyword و Crawl Stats از API جدید Bing و نمایش نمودارهای آنلاین در همین بخش است.</div>';
    }
    if (bingCard.parentElement !== body) body.appendChild(bingCard);

    const status = async () => {
      const box = bingCard.querySelector('#bingStatus');
      const message = bingCard.querySelector('#bingMessage');
      const connect = bingCard.querySelector('#bingConnect');
      const disconnect = bingCard.querySelector('#bingDisconnect');
      if (!box) return;
      box.innerHTML = '<span class="bing-dot"></span><span>در حال بررسی اتصال...</span>';
      if (message) message.innerHTML = '';
      try {
        const r = await fetch('/api/admin/analytics/bing/status', { credentials:'include', cache:'no-store' });
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error(d.error || 'خطا در بررسی اتصال Bing.');
        if (d.connected) {
          box.innerHTML = '<span class="bing-dot connected"></span><span>متصل به Bing Webmaster</span>';
          if (connect) connect.style.display = 'none';
          if (disconnect) disconnect.style.display = 'inline-flex';
          if (message) message.innerHTML = '<div class="bing-success">اتصال OAuth فعال است. دسترسی خواندن Webmaster برای این حساب ذخیره شده و آماده دریافت آمار است.</div>';
        } else {
          box.innerHTML = '<span class="bing-dot"></span><span>متصل نیست</span>';
          if (connect) connect.style.display = 'inline-flex';
          if (disconnect) disconnect.style.display = 'none';
        }
      } catch (e) {
        if (message) message.innerHTML = `<div class="bing-error">${String(e.message || 'خطا در بررسی اتصال Bing.')}</div>`;
      }
    };

    if (!bingCard.dataset.bound) {
      bingCard.dataset.bound = '1';
      bingCard.querySelector('#bingRefreshStatus')?.addEventListener('click', status);
      bingCard.querySelector('#bingConnect')?.addEventListener('click', () => { window.location.href='/api/admin/analytics/bing/connect'; });
      bingCard.querySelector('#bingDisconnect')?.addEventListener('click', async () => {
        const button = bingCard.querySelector('#bingDisconnect');
        if (button) { button.disabled = true; button.textContent = 'در حال قطع اتصال...'; }
        try {
          const r = await fetch('/api/admin/analytics/bing/disconnect', { method:'POST', credentials:'include' });
          const d = await r.json();
          if (!r.ok || !d.success) throw new Error(d.error || 'قطع اتصال Bing انجام نشد.');
        } catch (e) {
          const message = bingCard.querySelector('#bingMessage');
          if (message) message.innerHTML = `<div class="bing-error">${String(e.message || 'خطا در قطع اتصال Bing.')}</div>`;
        } finally {
          if (button) { button.disabled = false; button.textContent = 'قطع اتصال'; }
          status();
        }
      });
      status();
    }

    // Exact requested outer order: SEO, site traffic, Cloudflare, live Bing, Sources.
    section.appendChild(seo);
    section.appendChild(site);
    section.appendChild(cloudflare);
    section.appendChild(bingLive);
    section.appendChild(details);

    const heading = section.querySelector('.section-heading');
    if (heading) section.insertBefore(heading, section.firstChild);
    return true;
  };

  const addStyles = () => {
    if (document.querySelector('#adminAnalyticsLayoutStyles')) return;
    const style = document.createElement('style');
    style.id = 'adminAnalyticsLayoutStyles';
    style.textContent = `
      #analytics > .section-heading{margin-bottom:14px}
      .analytics-sources-details{margin-top:18px;padding:0;border:1px solid #e5e9f0;border-radius:14px;background:#fff;overflow:hidden}
      .analytics-sources-details summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;cursor:pointer;user-select:none}
      .analytics-sources-details summary::-webkit-details-marker{display:none}
      .analytics-sources-details summary > span:first-child{display:flex;flex-direction:column;gap:4px}
      .analytics-sources-details summary strong{font-size:14px}
      .analytics-sources-details summary small{font-size:11px;color:#667085}
      .analytics-sources-chevron{font-size:18px;color:#667085;transition:transform .18s ease}
      .analytics-sources-details[open] .analytics-sources-chevron{transform:rotate(180deg)}
      .analytics-sources-details-body{padding:0 18px 18px;border-top:1px solid #e5e9f0}
      .analytics-sources-actions{display:flex;justify-content:flex-start;padding-top:14px;margin-bottom:4px}
      .analytics-sources-details .analytics-source-grid{margin-top:12px}
      .analytics-sources-details .bing-analytics-card{margin-top:18px;padding:18px;border:1px solid #e5e9f0;border-radius:14px;background:#fff}
      .analytics-sources-details .bing-analytics-card .sms-section-title{margin-bottom:14px}
      .analytics-sources-details .bing-connect-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 14px;border:1px solid #e5e9f0;border-radius:12px;background:#f8fafc}
      .analytics-sources-details .bing-status{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700}
      .analytics-sources-details .bing-dot{width:9px;height:9px;border-radius:50%;background:#98a2b3;display:inline-block}
      .analytics-sources-details .bing-dot.connected{background:#12b76a}
      .analytics-sources-details .bing-actions{display:flex;gap:7px;flex-wrap:wrap}
      .analytics-sources-details #bingMessage{margin-top:10px}
      .analytics-sources-details .bing-success{padding:11px 13px;border-radius:10px;background:#ecfdf3;color:#027a48;font-size:11px;line-height:1.8}
      .analytics-sources-details .bing-help{margin-top:10px;color:#667085;font-size:11px;line-height:1.8}
      .analytics-sources-details .bing-error{padding:11px 13px;border-radius:10px;background:#fef3f2;color:#b42318;font-size:11px;line-height:1.8}
    `;
    document.head.appendChild(style);
  };

  const init = () => {
    addStyles();
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (setup() || tries >= 160) clearInterval(timer);
    }, 250);
    setup();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
