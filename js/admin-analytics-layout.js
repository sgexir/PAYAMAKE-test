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

    // Keep the existing analytics data/API code untouched; only rearrange its UI.
    if (!bing.dataset.sourcesMoved) {
      const details = document.createElement('details');
      details.className = 'analytics-sources-details';
      details.innerHTML = '<summary><span><strong>منابع آمار</strong><small>سه منبع اصلی آمار PAYAMAKE</small></span><span class="analytics-sources-chevron" aria-hidden="true">⌄</span></summary>';

      const body = document.createElement('div');
      body.className = 'analytics-sources-details-body';
      body.appendChild(sourceGrid);
      details.appendChild(body);

      const refresh = sourceCard.querySelector('#refreshSeoChecks');
      if (refresh) {
        const actions = document.createElement('div');
        actions.className = 'analytics-sources-actions';
        actions.appendChild(refresh);
        body.insertBefore(actions, body.firstChild);
      }

      sourceCard.remove();
      bing.appendChild(details);
      bing.dataset.sourcesMoved = '1';
    }

    // Exact requested order.
    const heading = section.querySelector('.section-heading');
    if (heading) section.appendChild(heading);
    section.appendChild(seo);
    section.appendChild(site);
    section.appendChild(cloudflare);
    section.appendChild(bing);
    return true;
  };

  const addStyles = () => {
    if (document.querySelector('#adminAnalyticsLayoutStyles')) return;
    const style = document.createElement('style');
    style.id = 'adminAnalyticsLayoutStyles';
    style.textContent = `
      #analytics > .section-heading{margin-bottom:14px}
      .analytics-sources-details{margin-top:18px;border-top:1px solid #e5e9f0;padding-top:4px}
      .analytics-sources-details summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 2px;cursor:pointer;user-select:none}
      .analytics-sources-details summary::-webkit-details-marker{display:none}
      .analytics-sources-details summary > span:first-child{display:flex;flex-direction:column;gap:3px}
      .analytics-sources-details summary strong{font-size:13px}
      .analytics-sources-details summary small{font-size:11px;color:#667085}
      .analytics-sources-chevron{font-size:18px;color:#667085;transition:transform .18s ease}
      .analytics-sources-details[open] .analytics-sources-chevron{transform:rotate(180deg)}
      .analytics-sources-details-body{padding:2px 0 4px}
      .analytics-sources-actions{display:flex;justify-content:flex-start;margin-bottom:10px}
      .analytics-sources-details .analytics-source-grid{margin-top:0}
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
