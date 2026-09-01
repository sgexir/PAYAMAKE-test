(() => {
  const SITE_URL = 'https://payamake.ir/';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));

  function setResults(results) {
    const box = $('#seoChecks');
    if (!box) return;
    box.innerHTML = results.map(([name, ok, detail]) => `<article class="seo-check"><div><strong>${esc(name)}</strong><small>${esc(detail)}</small></div><span class="seo-check-badge ${ok ? 'seo-ok' : 'seo-error'}">${ok ? 'سالم' : 'نیازمند بررسی'}</span></article>`).join('');
    const updated = $('#seoUpdated');
    if (updated) updated.textContent = `آخرین بررسی: ${new Date().toLocaleString('fa-IR')}`;
  }

  async function checkSite() {
    const box = $('#seoChecks');
    if (!box) return;
    box.innerHTML = '<div class="sms-loading">در حال بررسی سایت PAYAMAKE...</div>';
    try {
      const response = await fetch(SITE_URL, { cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const canonicalEl = doc.querySelector('link[rel="canonical"]');
      const descriptionEl = doc.querySelector('meta[name="description"]');
      const ogTitleEl = doc.querySelector('meta[property="og:title"]');
      const ogDescriptionEl = doc.querySelector('meta[property="og:description"]');
      const ogImageEl = doc.querySelector('meta[property="og:image"]');
      const canonical = canonicalEl?.getAttribute('href')?.trim() || '';
      const description = descriptionEl?.getAttribute('content')?.trim() || '';
      const ogTitle = ogTitleEl?.getAttribute('content')?.trim() || '';
      const ogDescription = ogDescriptionEl?.getAttribute('content')?.trim() || '';
      const ogImage = ogImageEl?.getAttribute('content')?.trim() || '';
      const canonicalOk = !!canonical && new URL(canonical, SITE_URL).hostname === new URL(SITE_URL).hostname;
      setResults([
        ['robots.txt', null, 'در حال بررسی...'],
        ['sitemap.xml', null, 'در حال بررسی...'],
        ['Canonical', canonicalOk, canonicalOk ? canonical : (canonical ? 'مقدار موجود است ولی دامنه صحیح نیست' : 'یافت نشد')],
        ['Meta description', !!description, description ? 'وجود دارد' : 'یافت نشد'],
        ['Open Graph', !!(ogTitle && ogDescription && ogImage), ogTitle && ogDescription && ogImage ? 'عنوان، توضیح و تصویر وجود دارد' : 'یک یا چند سیگنال Open Graph یافت نشد']
      ]);
      const [robots, sitemap] = await Promise.all([
        fetch(new URL('/robots.txt', SITE_URL), { cache: 'no-store' }).then(r => r.ok).catch(() => false),
        fetch(new URL('/sitemap.xml', SITE_URL), { cache: 'no-store' }).then(r => r.ok).catch(() => false)
      ]);
      const finalResults = [
        ['robots.txt', robots, robots ? 'قابل دسترسی' : 'قابل دسترسی نیست'],
        ['sitemap.xml', sitemap, sitemap ? 'قابل دسترسی' : 'قابل دسترسی نیست'],
        ['Canonical', canonicalOk, canonicalOk ? canonical : (canonical ? 'مقدار موجود است ولی دامنه صحیح نیست' : 'یافت نشد')],
        ['Meta description', !!description, description ? 'وجود دارد' : 'یافت نشد'],
        ['Open Graph', !!(ogTitle && ogDescription && ogImage), ogTitle && ogDescription && ogImage ? 'عنوان، توضیح و تصویر وجود دارد' : 'یک یا چند سیگنال Open Graph یافت نشد']
      ];
      setResults(finalResults);
    } catch (error) {
      setResults([
        ['robots.txt', false, 'بررسی سایت ناموفق بود'],
        ['sitemap.xml', false, 'بررسی سایت ناموفق بود'],
        ['Canonical', false, error.message || 'بررسی سایت ناموفق بود'],
        ['Meta description', false, 'بررسی سایت ناموفق بود'],
        ['Open Graph', false, 'بررسی سایت ناموفق بود']
      ]);
    }
  }

  function boot() {
    if (!$('#seoChecks')) return;
    const refresh = $('#refreshSeoChecks');
    if (refresh) {
      refresh.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        checkSite();
      }, true);
    }
    checkSite();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
