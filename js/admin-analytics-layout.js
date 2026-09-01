(() => {
  'use strict';
  if (!location.pathname.startsWith('/admin')) return;

  const setup = () => {
    const section = document.querySelector('#analytics');
    if (!section) return false;

    const seo = section.querySelector('#seoChecks')?.closest('.sms-section-card');
    const site = section.querySelector('#siteTrafficAnalyticsCard');
    const cloudflare = section.querySelector('#cloudflareAnalyticsCard');
    const bing = section.querySelector('.bing-live-card');
    const sourceGrid = section.querySelector('.analytics-source-grid');
    const sourceCard = sourceGrid?.closest('.sms-section-card');

    if (!seo || !site || !cloudflare || !bing || !sourceGrid || !sourceCard) return false;

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

    // Exact requested order: SEO, site traffic, Worker analytics, Google/Bing, Sources.
    section.appendChild(seo);
    section.appendChild(site);
    section.appendChild(cloudflare);
    section.appendChild(bing);
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
