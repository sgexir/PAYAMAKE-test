(() => {
  'use strict';
  if (!location.pathname.startsWith('/admin')) return;

  const STORAGE_KEY = 'payamake_admin_analytics_layout_v1';
  const DEFAULT_ORDER = ['seo', 'gsc', 'site', 'cloudflare', 'bing', 'sources'];
  const META = {
    seo: { title: 'سلامت پایه SEO', subtitle: 'بررسی شاخص‌های پایه و فنی سایت.', selector: '#seoChecks', collapsible: false },
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
      sources.innerHTML = '<summary><span><strong>منابع آمار</strong><small>سه منبع اصلی آمار PAYAMAKE از همین‌جا در دسترس هستند.</small></span><span class="analytics-chevron" aria-hidden="true">⌄</span></summary><div class="analytics-sources-details-body"></div>';
      const body = sources.querySelector('.analytics-sources-details-body');
      const refresh = sourceCard.querySelector('#refreshSeoChecks');
      if (refresh) { const a=document.createElement('div'); a.className='analytics-sources-actions'; a.appendChild(refresh); body.appendChild(a); }
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

    const status = async () => {
      const box=bingCard.querySelector('#bingStatus'), msg=bingCard.querySelector('#bingMessage'), connect=bingCard.querySelector('#bingConnect'), disconnect=bingCard.querySelector('#bingDisconnect');
      if (!box) return;
      try {
        const r=await fetch('/api/admin/analytics/bing/status',{credentials:'include',cache:'no-store'}), d=await r.json();
        if (!r.ok || !d.success) throw new Error(d.error||'خطا در بررسی اتصال Bing.');
        box.innerHTML=d.connected?'<span class="bing-dot connected"></span><span>متصل به Bing Webmaster</span>':'<span class="bing-dot"></span><span>متصل نیست</span>';
        if(connect)connect.style.display=d.connected?'none':'inline-flex';
        if(disconnect)disconnect.style.display=d.connected?'inline-flex':'none';
        if(msg)msg.innerHTML=d.connected?'<div class="bing-success">اتصال OAuth فعال است. دسترسی خواندن Webmaster برای این حساب ذخیره شده و آماده دریافت آمار است.</div>':'';
      } catch(e) { if(msg)msg.innerHTML=`<div class="bing-error">${String(e.message||'خطا در بررسی اتصال Bing.')}</div>`; }
    };
    if(!bingCard.dataset.bound){
      bingCard.dataset.bound='1';
      bingCard.querySelector('#bingRefreshStatus')?.addEventListener('click',status);
      bingCard.querySelector('#bingConnect')?.addEventListener('click',()=>{location.href='/api/admin/analytics/bing/connect';});
      bingCard.querySelector('#bingDisconnect')?.addEventListener('click',async()=>{try{await fetch('/api/admin/analytics/bing/disconnect',{method:'POST',credentials:'include'});}finally{status();}});
      status();
    }

    const wrap = (card, className, title, subtitle, defaultOpen=false) => {
      if (!card) return null;
      const current=card.closest(`details.${className}`);
      if(current) return current;
      const d=document.createElement('details'); d.className=`sms-section-card analytics-collapsible ${className}`;
      d.dataset.analyticsId = Object.keys(META).find(id => META[id].selector === `#${card.id}` || (id === 'bing' && className === 'bing-analytics-details') || (id === 'cloudflare' && className === 'cloudflare-analytics-details')) || '';
      const summary=document.createElement('summary'); summary.innerHTML=`<span><strong>${title}</strong><small>${subtitle}</small></span><span class="analytics-chevron" aria-hidden="true">⌄</span>`;
      const content=document.createElement('div'); content.className='analytics-collapsible-body';
      card.parentNode.insertBefore(d,card); content.appendChild(card); d.appendChild(summary); d.appendChild(content);
      if(defaultOpen) d.open=true;
      return d;
    };
    const prefs = readPrefs();
    const cloudWrap=wrap(cloudflare,'cloudflare-analytics-details','Cloudflare Analytics','آمار آنلاین واقعی Cloudflare داخل پنل PAYAMAKE.');
    const bingWrap=wrap(bingLive,'bing-analytics-details','Google / Bing Search Analytics','Bing Webmaster: https://payamake.ir/');
    const gscWrap=gsc ? wrap(gsc,'google-search-analytics-details','Google Search Console','داده واقعی Search Analytics سایت payamake.ir داخل پنل.') : null;

    const items = { seo, gsc: gscWrap || gsc, site, cloudflare: cloudWrap, bing: bingWrap, sources };
    normalizedOrder(prefs.order).forEach(id => {
      const item = items[id];
      if (!item) return;
      section.appendChild(item);
      if (META[id].collapsible && item.tagName === 'DETAILS') {
        if (Object.prototype.hasOwnProperty.call(prefs.open, id)) item.open = Boolean(prefs.open[id]);
        else item.open = false;
      }
    });

    if (!section.dataset.analyticsBound) {
      section.dataset.analyticsBound='1';
      section.addEventListener('toggle', e => {
        const details = e.target.closest('details[data-analytics-id]');
        if (!details) return;
        const current = readPrefs();
        current.open[details.dataset.analyticsId] = details.open;
        savePrefs(current);
      }, true);
    }

    installSettings(section, prefs, items);
    const heading=section.querySelector('.section-heading'); if(heading)section.insertBefore(heading,section.firstChild);
    return true;
  };

  const installSettings = (section, initialPrefs, items) => {
    let panel = section.querySelector('.analytics-display-settings');
    if (panel) return;
    panel = document.createElement('details');
    panel.className = 'sms-section-card analytics-display-settings';
    panel.open = false;
    panel.innerHTML = '<summary><span><strong>تنظیمات نمایش Analytics</strong><small>ترتیب بخش‌ها و وضعیت باز/بسته را از اینجا کنترل کنید.</small></span><span class="analytics-chevron" aria-hidden="true">⌄</span></summary><div class="analytics-settings-body"><div class="analytics-settings-hint">برای جابه‌جایی، ردیف‌ها را بکشید و رها کنید. وضعیت هر بخش هم از همین‌جا قابل تعیین است.</div><div class="analytics-settings-list"></div><div class="analytics-settings-actions"><button type="button" class="admin-button primary small" data-analytics-save>ذخیره تنظیمات</button><button type="button" class="admin-button outline small" data-analytics-reset>بازگردانی پیش‌فرض</button></div></div>';
    const list = panel.querySelector('.analytics-settings-list');
    const prefs = readPrefs();
    normalizedOrder(prefs.order).forEach(id => {
      if (!items[id]) return;
      const row = document.createElement('div');
      row.className='analytics-setting-row'; row.draggable=true; row.dataset.id=id;
      const canCollapse = META[id].collapsible;
      row.innerHTML=`<span class="analytics-drag" title="جابجایی">☰</span><span class="analytics-setting-title"><strong>${META[id].title}</strong><small>${META[id].subtitle}</small></span>${canCollapse?`<label class="analytics-setting-toggle"><input type="checkbox" data-open="${id}"><span>باز</span></label>`:'<span class="analytics-setting-fixed">ثابت</span>'}`;
      if(canCollapse) row.querySelector('input').checked=Boolean(prefs.open[id]);
      list.appendChild(row);
    });
    list.addEventListener('dragstart', e => { const row=e.target.closest('.analytics-setting-row'); if(row){row.classList.add('is-dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',row.dataset.id);} });
    list.addEventListener('dragend', e => e.target.closest('.analytics-setting-row')?.classList.remove('is-dragging'));
    list.addEventListener('dragover', e => { e.preventDefault(); const dragging=list.querySelector('.is-dragging'), target=e.target.closest('.analytics-setting-row'); if(!dragging||!target||dragging===target)return; const rect=target.getBoundingClientRect(); list.insertBefore(dragging,e.clientY<rect.top+rect.height/2?target:target.nextSibling); });
    panel.querySelector('[data-analytics-save]').addEventListener('click', () => {
      const next={order:[...list.querySelectorAll('.analytics-setting-row')].map(r=>r.dataset.id),open:{...readPrefs().open}};
      list.querySelectorAll('input[data-open]').forEach(i=>{next.open[i.dataset.open]=i.checked;});
      savePrefs({order:normalizedOrder(next.order),open:next.open});
      applyPrefs(section, next, items);
      panel.open=false;
    });
    panel.querySelector('[data-analytics-reset]').addEventListener('click', () => { const next={order:DEFAULT_ORDER.slice(),open:{}}; savePrefs(next); location.reload(); });
    section.insertBefore(panel, section.querySelector('.section-heading')?.nextSibling || section.firstChild);
  };

  const applyPrefs = (section, prefs, items) => {
    normalizedOrder(prefs.order).forEach(id => { const item=items[id]; if(!item)return; section.appendChild(item); if(item.tagName==='DETAILS'&&META[id].collapsible&&Object.prototype.hasOwnProperty.call(prefs.open,id))item.open=Boolean(prefs.open[id]); });
    const heading=section.querySelector('.section-heading'); const settings=section.querySelector('.analytics-display-settings'); if(heading)section.insertBefore(heading,section.firstChild); if(settings)section.insertBefore(settings,heading?.nextSibling||section.firstChild);
  };

  const styles=()=>{ if(document.querySelector('#adminAnalyticsLayoutStyles'))return; const s=document.createElement('style'); s.id='adminAnalyticsLayoutStyles'; s.textContent=`
    #analytics > .section-heading{margin-bottom:14px}
    .analytics-collapsible,.analytics-sources-details,.analytics-display-settings{margin-top:18px;padding:0;border:1px solid #e5e9f0;border-radius:14px;background:#fff;overflow:hidden}
    .analytics-collapsible>summary,.analytics-sources-details>summary,.analytics-display-settings>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;cursor:pointer;user-select:none}
    .analytics-collapsible>summary::-webkit-details-marker,.analytics-sources-details>summary::-webkit-details-marker,.analytics-display-settings>summary::-webkit-details-marker{display:none}
    .analytics-collapsible>summary>span:first-child,.analytics-sources-details>summary>span:first-child,.analytics-display-settings>summary>span:first-child{display:flex;flex-direction:column;gap:4px}
    .analytics-collapsible summary strong,.analytics-sources-details summary strong,.analytics-display-settings summary strong{font-size:14px}.analytics-collapsible summary small,.analytics-sources-details summary small,.analytics-display-settings summary small{font-size:11px;color:#667085}
    .analytics-chevron{font-size:18px;color:#667085;transition:transform .18s ease}.analytics-collapsible[open] .analytics-chevron,.analytics-sources-details[open] .analytics-chevron,.analytics-display-settings[open] .analytics-chevron{transform:rotate(180deg)}
    .analytics-collapsible-body{padding:0 18px 18px;border-top:1px solid #e5e9f0}.analytics-collapsible-body>.sms-section-card{margin-top:18px}
    .analytics-sources-details-body{padding:0 18px 18px;border-top:1px solid #e5e9f0}.analytics-sources-actions{display:flex;justify-content:flex-start;padding-top:14px;margin-bottom:4px}
    .analytics-sources-details .analytics-source-grid{margin-top:12px}.analytics-sources-details .bing-analytics-card{margin-top:18px;padding:18px;border:1px solid #e5e9f0;border-radius:14px;background:#fff}
    .analytics-sources-details .bing-connect-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 14px;border:1px solid #e5e9f0;border-radius:12px;background:#f8fafc}
    .analytics-sources-details .bing-status{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700}.analytics-sources-details .bing-dot{width:9px;height:9px;border-radius:50%;background:#98a2b3;display:inline-block}.analytics-sources-details .bing-dot.connected{background:#12b76a}
    .analytics-sources-details .bing-actions{display:flex;gap:7px;flex-wrap:wrap}.analytics-sources-details #bingMessage{margin-top:10px}.analytics-sources-details .bing-success{padding:11px 13px;border-radius:10px;background:#ecfdf3;color:#027a48;font-size:11px;line-height:1.8}.analytics-sources-details .bing-error{padding:11px 13px;border-radius:10px;background:#fef3f2;color:#b42318;font-size:11px;line-height:1.8}.analytics-sources-details .bing-help{margin-top:10px;color:#667085;font-size:11px;line-height:1.8}
    .analytics-settings-body{padding:0 18px 18px;border-top:1px solid #e5e9f0}.analytics-settings-hint{margin:14px 0 10px;padding:10px 12px;border-radius:10px;background:#f8fafc;color:#667085;font-size:11px;line-height:1.8}.analytics-settings-list{display:grid;gap:8px}.analytics-setting-row{display:flex;align-items:center;gap:10px;padding:11px 12px;border:1px solid #e5e9f0;border-radius:11px;background:#fff;cursor:grab}.analytics-setting-row.is-dragging{opacity:.5}.analytics-drag{font-size:17px;color:#98a2b3;cursor:grab}.analytics-setting-title{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}.analytics-setting-title strong{font-size:12px}.analytics-setting-title small{font-size:10px;color:#667085;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.analytics-setting-toggle{display:flex;align-items:center;gap:7px;font-size:11px;color:#475467;white-space:nowrap}.analytics-setting-toggle input{width:18px;height:18px}.analytics-setting-fixed{font-size:10px;color:#98a2b3}.analytics-settings-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
    @media(max-width:700px){.analytics-setting-title small{white-space:normal}.analytics-setting-row{align-items:flex-start}.analytics-setting-toggle{padding-top:2px}}
  `; document.head.appendChild(s); };
  const init=()=>{styles();let n=0;const t=setInterval(()=>{if(setup()||++n>=160)clearInterval(t)},250);setup();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
