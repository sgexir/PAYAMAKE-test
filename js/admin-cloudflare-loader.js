(() => {
  const boot = () => {
    if (window.__payamakeCloudflareLoaderBooted) return;
    if (location.pathname !== '/admin/' && location.pathname !== '/admin/index.html') return;
    window.__payamakeCloudflareLoaderBooted = true;
    const load = () => {
      if (!document.querySelector('script[data-cf-analytics-runtime]')) {
        const s = document.createElement('script');
        s.src = '../js/admin-cloudflare.js?v=5';
        s.dataset.cfAnalyticsRuntime = '1';
        s.defer = true;
        document.body.appendChild(s);
      }
      if (!document.querySelector('script[data-analytics-layout-runtime]')) {
        const layout = document.createElement('script');
        layout.src = '../js/admin-analytics-layout.js?v=1';
        layout.dataset.analyticsLayoutRuntime = '1';
        layout.defer = true;
        document.body.appendChild(layout);
      }
      if (!document.querySelector('script[data-seo-checker-runtime]')) {
        const seo = document.createElement('script');
        seo.src = '../js/admin-seo-checker.js?v=1';
        seo.dataset.seoCheckerRuntime = '1';
        seo.defer = true;
        document.body.appendChild(seo);
      }
      if (!document.querySelector('style[data-site-traffic-collapse]')) {
        const style = document.createElement('style');
        style.dataset.siteTrafficCollapse = '1';
        style.textContent = '.site-traffic-card .site-traffic-collapse-body{display:none}.site-traffic-card.is-open .site-traffic-collapse-body{display:block}.site-traffic-card .site-traffic-collapse-toggle{min-width:34px;height:34px;padding:0 10px}.site-traffic-card .site-traffic-collapse-toggle::after{content:"⌄";font-size:18px;line-height:1}.site-traffic-card.is-open .site-traffic-collapse-toggle::after{content:"⌃"}';
        document.head.appendChild(style);
      }
      const enhance = () => {
        const card = document.querySelector('#siteTrafficAnalyticsCard');
        if (!card || card.dataset.collapsibleReady === '1') return;
        const title = card.querySelector('.sms-section-title');
        if (!title) return;
        const refresh = title.querySelector('#siteTrafficRefresh');
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'admin-button outline small site-traffic-collapse-toggle';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'نمایش جزئیات ترافیک سایت');
        title.appendChild(toggle);

        const body = document.createElement('div');
        body.className = 'site-traffic-collapse-body';
        while (card.children.length > 1) body.appendChild(card.lastElementChild);
        card.appendChild(body);
        card.dataset.collapsibleReady = '1';

        toggle.addEventListener('click', () => {
          const open = card.classList.toggle('is-open');
          toggle.setAttribute('aria-expanded', String(open));
          toggle.setAttribute('aria-label', open ? 'بستن جزئیات ترافیک سایت' : 'نمایش جزئیات ترافیک سایت');
        });
      };
      const observer = new MutationObserver(enhance);
      observer.observe(document.body, { childList: true, subtree: true });
      enhance();
    };
    if (document.body) load(); else document.addEventListener('DOMContentLoaded', load, { once: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
