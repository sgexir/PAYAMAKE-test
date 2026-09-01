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
    };
    if (document.body) load(); else document.addEventListener('DOMContentLoaded', load, { once: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
