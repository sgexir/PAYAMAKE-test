(() => {
  'use strict';
  if (!location.pathname.startsWith('/admin')) return;

  const STORAGE_KEY = 'payamake_admin_analytics_layout_v1';
  const DEFAULT_ORDER = ['seo', 'gsc', 'site', 'cloudflare', 'bing', 'sources'];
  const META = {
    seo: { title: 'سلامت پایه SEO', subtitle: 'بررسی مستقیم فایل‌ها و سیگنال‌های فنی سایت.', selector: '#seoChecks', collapsible: true },
    gsc: { title: 'Google Search Console', subtitle: 'داده واقعی Search Analytics سایت payamake.ir داخل پنل.', selector: '#googleSearchConsoleCard', collapsible: true },
    site: { title: 'آمار ترافیک سایت', subtitle: 'آمار بازدید و ترافیک سایت داخل پنل.', selector: '#siteTrafficAnalyticsCard', collapsible: true },
    cloudflare: { title: 'Cloudflare Analytics', subtitle: 'آمار آنلاین واقعی Cloudflare داخل پنل PAYAMAKE.', selector: '#cloudflareAnalyticsCard', collapsible: true },
    bing: { title: 'Google / Bing Search Analytics', subtitle: 'Bing Webmaster: https://payamake.ir/', selector: '.bing-live-card', collapsible: true },
    sources: { title: 'منابع آمار', subtitle: 'سه منبع اصلی آمار PAYAMAKE از همین‌جا در دسترس هستند.', selector: '.analytics-sources-details', collapsible: true }
  };

  const readPrefs = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const value = raw ? JSON.parse(raw) : {};
      return {
        order: Array.isArray(value.order) ? value.order.filter(id => META[id]) : DEFAULT_ORDER.slice(),
        open: value.open && typeof value.open === 'object' ? value.open : {}
      };
    } catch (_) { return { order: DEFAULT_ORDER.slice(), open: {} }; }
  };
  const savePrefs = prefs => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs)); } catch (_) {} };
  const normalizedOrder = order => [...new Set([...(order || []), ...DEFAULT_ORDER])].filter(id => META[id]);

  const wrap = (card, className, title, subtitle) => {
    if (!card) return null;
    const current = card.closest(`details.${className}`);
    if (current) return current;
    const d = document.createElement('details');
    d.className = `sms-section-card analytics-collapsible ${className}`;
    const id = Object.keys(META).find(key => META[key].selector === `#${card.id}` || (key === 'bing' && className === 'bing-analytics-details') || (key === 'cloudflare' && className === 'cloudflare-analytics-details') || (key === 'seo' && card.querySelector('#seoChecks')));
    if (id) d.dataset.analyticsId = id;
    const summary = document.createElement('summary');
    summary.innerHTML = `<span><strong>${title}</strong><small>${subtitle}</small></span><span class="analytics-chevron" aria-hidden="true">⌄</span>`;
    const content = document.createElement('div');
    content.className = 'analytics-collapsible-body';
    card.parentNode.insertBefore(d, card);
    content.appendChild(card);
    d.appendChild(summary);
    d.appendChild(content);
    return d;
  };

  const setup = () => {
    const section = document.querySelector('#analytics');
    if (!section) return false;

    const seo = section.querySelector('#seoChecks')?.closest('.sms-section-card');
    const site = section.querySelector('#siteTrafficAnalyticsCard');
    const cloudflare = section.querySelector('#cloudflareAnalyticsCard');
    const bingLive = section.querySelector('.bing-live-card');
    const gsc = section.querySelector('#googleSearchConsoleCard');
    const sourceGrid = section.querySelector('.analytics-source-grid');
    const sourceCard = sourceGrid?.closest('.sms-section-card');
    if (!seo || !site || !cloudflare || !bingLive || !sourceGrid || !sourceCard) return false;

    let sources = section.querySelector('.analytics-sources-details');
    if (!sources) {
      sources = document.createElement('details');
      sources.className = 'sms-section-card analytics-sources-details';
      sources.dataset.analyticsId = 'sources';
      sources.innerHTML = '<summary><span><strong>منابع آمار</strong><small>سه منبع اصلی آمار PAYAMAKE از همین‌جا در دسترس هستند.</small></span><span class="analytics-chevron" aria-hidden="true">⌄</span></summary><div class="analytics-sources-details-body"></div>';
      const body = sources.querySelector('.analytics-sources-details-body');
      const refresh = sourceCard.querySelector('#refreshSeoChecks');
      if (refresh) { const a = document.createElement('div'); a.className = 'analytics-sources-actions'; a.appendChild(refresh); body.appendChild(a); }
      body.appendChild(sourceGrid);
      sourceCard.remove();
      section.appendChild(sources);
    }

    const body = sources.querySelector('.analytics-sources-details-body');
    let bingCard = section.querySelector('#bingAnalyticsCard');
    if (!bingCard) {
      bingCard = document.createElement('div');
      bingCard.id = 'bingAnalyticsCard';
      bingCard.className = 'sms-section-card bing-analytics-card';
      bingCard.innerHTML = '<div class="sms-section-title"><div><h3>Google / Bing Search Analytics</h3><span>اتصال مستقیم به Bing Webmaster برای نمایش آمار واقعی داخل پنل.</span></div><button id="bingRefreshStatus" class="admin-button outline small" type="button">بروزرسانی</button></div><div class="bing-connect-row"><div id="bingStatus" class="bing-status"><span class="bing-dot"></span><span>در حال بررسی اتصال...</span></div><div class="bing-actions"><button id="bingConnect" class="admin-button primary small" type="button">اتصال Bing Webmaster</button><button id="bingDisconnect" class="admin-button outline small" type="button" style="display:none">قطع اتصال</button></div></div><div id="bingMessage"></div><div class="bing-help">پس از اتصال، مرحله بعد دریافت Rank، Traffic، Keyword و Crawl Stats از API جدید Bing و نمایش نمودارهای آنلاین در همین بخش است.</div>';
      body.appendChild(bingCard);
    } else if (bingCard.parentElement !== body) body.appendChild(bingCard);

    const prefs = readPrefs();
    const seoWrap = wrap(seo, 'seo-health-details', 'سلامت پایه SEO', 'بررسی مستقیم فایل‌ها و سیگنال‌های فنی سایت.');
    const cloudWrap = wrap(cloudflare, 'cloudflare-analytics-details', 'Cloudflare Analytics', 'آمار آنلاین واقعی Cloudflare داخل پنل PAYAMAKE.');
    const bingWrap = wrap(bingLive, 'bing-analytics-details', 'Google / Bing Search Analytics', 'Bing Webmaster: https://payamake.ir/');
    const gscWrap = gsc ? wrap(gsc, 'google-search-analytics-details', 'Google Search Console', 'داده واقعی Search Analytics سایت payamake.ir داخل پنل.') : null;

    const items = { seo: seoWrap || seo, gsc: gscWrap || gsc, site, cloudflare: cloudWrap, bing: bingWrap, sources };
    normalizedOrder(prefs.order).forEach(id => {
      const item = items[id];
      if (!item) return;
      section.appendChild(item);
      if (META[id].collapsible && item.tagName === 'DETAILS') {
        item.open = Object.prototype.hasOwnProperty.call(prefs.open, id) ? Boolean(prefs.open[id]) : false;
      }
    });

    if (!section.dataset.analyticsBound) {
      section.dataset.analyticsBound = '1';
      section.addEventListener('toggle', e => {
        const details = e.target.closest('details[data-analytics-id]');
        if (!details) return;
        const current = readPrefs();
        current.open[details.dataset.analyticsId] = details.open;
        savePrefs(current);
      }, true);
    }

    installSettings(section, items);
    const heading = section.querySelector('.section-heading');
    if (heading) section.insertBefore(heading, section.firstChild);
    return true;
  };

  const installSettings = (section, items) => {
    let panel = section.querySelector('.analytics-display-settings');
    if (panel) {
      // Always re-append an existing settings panel so it remains after «منابع آمار».
      section.appendChild(panel);
      return;
    }
    panel = document.createElement('details');
    panel.className = 'sms-section-card analytics-display-settings';
    panel.open = false;
    panel.innerHTML = '<summary><span><strong>تنظیمات نمایش Analytics</strong><small>ترتیب بخش‌ها و وضعیت باز/بسته را از اینجا کنترل کنید.</small></span><span class="analytics-chevron" aria-hidden="true">⌄</span></summary><div class="analytics-settings-body"><div class="analytics-settings-hint">برای جابه‌جایی، ردیف‌ها را بکشید و رها کنید. وضعیت هر بخش هم از همین‌جا قابل تعیین است.</div><div class="analytics-settings-list"></div><div class="analytics-settings-actions"><button type="button" class="admin-button primary small" data-analytics-save>ذخیره تنظیمات</button><button type="button" class="admin-button outline small" data-analytics-reset>بازگردانی پیش‌فرض</button></div></div>';
    const list = panel.querySelector('.analytics-settings-list');
    const prefs = readPrefs();
    normalizedOrder(prefs.order).forEach(id => {
      if (!items[id]) return;
      const row = document.createElement('div');
      row.className = 'analytics-setting-row';
      row.draggable = true;
      row.dataset.id = id;
      const canCollapse = META[id].collapsible;
      row.innerHTML = `<span class="analytics-drag" title="جابجایی">☰</span><span class="analytics-setting-title"><strong>${META[id].title}</strong><small>${META[id].subtitle}</small></span>${canCollapse ? `<label class="analytics-setting-toggle"><input type="checkbox" data-open="${id}"><span>باز</span></label>` : '<span class="analytics-setting-fixed">ثابت</span>'}`;
      if (canCollapse) row.querySelector('input').checked = Boolean(prefs.open[id]);
      list.appendChild(row);
    });

    list.addEventListener('dragstart', e => { const row = e.target.closest('.analytics-setting-row'); if (row) { row.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', row.dataset.id); } });
    list.addEventListener('dragend', e => e.target.closest('.analytics-setting-row')?.classList.remove('is-dragging'));
    list.addEventListener('dragover', e => { e.preventDefault(); const dragging = list.querySelector('.is-dragging'), target = e.target.closest('.analytics-setting-row'); if (!dragging || !target || dragging === target) return; const rect = target.getBoundingClientRect(); list.insertBefore(dragging, e.clientY < rect.top + rect.height / 2 ? target : target.nextSibling); });

    panel.querySelector('[data-analytics-save]').addEventListener('click', () => {
      const next = { order: [...list.querySelectorAll('.analytics-setting-row')].map(r => r.dataset.id), open: { ...readPrefs().open } };
      list.querySelectorAll('input[data-open]').forEach(i => { next.open[i.dataset.open] = i.checked; });
      savePrefs({ order: normalizedOrder(next.order), open: next.open });
      applyPrefs(section, next, items);
      panel.open = false;
    });
    panel.querySelector('[data-analytics-reset]').addEventListener('click', () => { savePrefs({ order: DEFAULT_ORDER.slice(), open: {} }); location.reload(); });

    // Settings is intentionally outside the draggable analytics order and always stays last.
    section.appendChild(panel);
  };

  const applyPrefs = (section, prefs, items) => {
    normalizedOrder(prefs.order).forEach(id => {
      const item = items[id];
      if (!item) return;
      section.appendChild(item);
      if (item.tagName === 'DETAILS' && META[id].collapsible && Object.prototype.hasOwnProperty.call(prefs.open, id)) item.open = Boolean(prefs.open[id]);
    });
    const heading = section.querySelector('.section-heading');
    const settings = section.querySelector('.analytics-display-settings');
    if (heading) section.insertBefore(heading, section.firstChild);
    if (settings) section.appendChild(settings);
  };

  const styles = () => {
    if (document.querySelector('#adminAnalyticsLayoutStyles')) return;
    const s = document.createElement('style');
    s.id = 'adminAnalyticsLayoutStyles';
    s.textContent = `
      #analytics > .section-heading{margin-bottom:14px}
      .analytics-collapsible,.analytics-sources-details,.analytics-display-settings{margin-top:18px;padding:0;border:1px solid #e5e9f0;border-radius:14px;background:#fff;overflow:hidden}
      .analytics-collapsible>summary,.analytics-sources-details>summary,.analytics-display-settings>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;cursor:pointer;user-select:none}
      .analytics-collapsible>summary::-webkit-details-marker,.analytics-sources-details>summary::-webkit-details-marker,.analytics-display-settings>summary::-webkit-details-marker{display:none}
      .analytics-collapsible>summary>span:first-child,.analytics-sources-details>summary>span:first-child,.analytics-display-settings>summary>span:first-child{display:flex;flex-direction:column;gap:4px}
      .analytics-collapsible summary strong,.analytics-sources-details summary strong,.analytics-display-settings summary strong{font-size:14px}
      .analytics-collapsible summary small,.analytics-sources-details summary small,.analytics-display-settings summary small{font-size:12px;color:#7b8492}
      .analytics-chevron{font-size:20px;transition:transform .2s ease}
      details[open]>summary .analytics-chevron{transform:rotate(180deg)}
      .analytics-collapsible-body{padding:0 18px 18px}
      .analytics-sources-details-body{padding:0 18px 18px}
      .analytics-sources-actions{display:flex;justify-content:flex-end;margin-bottom:12px}
      .analytics-display-settings{margin-top:18px}
      .analytics-settings-body{padding:0 18px 18px}
      .analytics-settings-hint{font-size:12px;color:#7b8492;margin-bottom:12px}
      .analytics-settings-list{display:flex;flex-direction:column;gap:8px}
      .analytics-setting-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #e5e9f0;border-radius:10px;background:#fff;cursor:grab}
      .analytics-setting-row.is-dragging{opacity:.55}
      .analytics-drag{font-size:16px;color:#8b93a1;line-height:1}
      .analytics-setting-title{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}
      .analytics-setting-title strong{font-size:13px}
      .analytics-setting-title small{font-size:11px;color:#7b8492;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .analytics-setting-toggle{display:inline-flex;align-items:center;gap:6px;font-size:12px;white-space:nowrap}
      .analytics-setting-fixed{font-size:11px;color:#7b8492;white-space:nowrap}
      .analytics-settings-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
      @media (max-width:640px){
        .analytics-collapsible>summary,.analytics-sources-details>summary,.analytics-display-settings>summary{padding:14px}
        .analytics-collapsible-body,.analytics-sources-details-body,.analytics-settings-body{padding-left:14px;padding-right:14px}
        .analytics-setting-row{padding:9px}
        .analytics-setting-title small{white-space:normal}
      }
    `;
    document.head.appendChild(s);
  };

  const boot = () => {
    styles();
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (setup() || tries > 160) clearInterval(timer);
    }, 250);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();