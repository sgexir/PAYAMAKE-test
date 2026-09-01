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

    const wrap = (card, className, title, subtitle) => {
      if (!card) return null;
      const current=card.closest(`details.${className}`);
      if(current) return current;
      const d=document.createElement('details'); d.className=`sms-section-card analytics-collapsible ${className}`;
      const summary=document.createElement('summary'); summary.innerHTML=`<span><strong>${title}</strong><small>${subtitle}</small></span><span class="analytics-chevron" aria-hidden="true">⌄</span>`;
      const content=document.createElement('div'); content.className='analytics-collapsible-body';
      card.parentNode.insertBefore(d,card); content.appendChild(card); d.appendChild(summary); d.appendChild(content); return d;
    };
    const cloudWrap=wrap(cloudflare,'cloudflare-analytics-details','Cloudflare Analytics','آمار آنلاین واقعی Cloudflare داخل پنل PAYAMAKE.');
    const bingWrap=wrap(bingLive,'bing-analytics-details','Google / Bing Search Analytics','Bing Webmaster: https://payamake.ir/');

    section.appendChild(seo); section.appendChild(site); if(cloudWrap)section.appendChild(cloudWrap); if(bingWrap)section.appendChild(bingWrap); section.appendChild(sources);
    const heading=section.querySelector('.section-heading'); if(heading)section.insertBefore(heading,section.firstChild);
    return true;
  };

  const styles=()=>{ if(document.querySelector('#adminAnalyticsLayoutStyles'))return; const s=document.createElement('style'); s.id='adminAnalyticsLayoutStyles'; s.textContent=`
    #analytics > .section-heading{margin-bottom:14px}
    .analytics-collapsible,.analytics-sources-details{margin-top:18px;padding:0;border:1px solid #e5e9f0;border-radius:14px;background:#fff;overflow:hidden}
    .analytics-collapsible>summary,.analytics-sources-details>summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;cursor:pointer;user-select:none}
    .analytics-collapsible>summary::-webkit-details-marker,.analytics-sources-details>summary::-webkit-details-marker{display:none}
    .analytics-collapsible>summary>span:first-child,.analytics-sources-details>summary>span:first-child{display:flex;flex-direction:column;gap:4px}
    .analytics-collapsible summary strong,.analytics-sources-details summary strong{font-size:14px}.analytics-collapsible summary small,.analytics-sources-details summary small{font-size:11px;color:#667085}
    .analytics-chevron{font-size:18px;color:#667085;transition:transform .18s ease}.analytics-collapsible[open] .analytics-chevron,.analytics-sources-details[open] .analytics-chevron{transform:rotate(180deg)}
    .analytics-collapsible-body{padding:0 18px 18px;border-top:1px solid #e5e9f0}.analytics-collapsible-body>.sms-section-card{margin-top:18px}
    .analytics-sources-details-body{padding:0 18px 18px;border-top:1px solid #e5e9f0}.analytics-sources-actions{display:flex;justify-content:flex-start;padding-top:14px;margin-bottom:4px}
    .analytics-sources-details .analytics-source-grid{margin-top:12px}.analytics-sources-details .bing-analytics-card{margin-top:18px;padding:18px;border:1px solid #e5e9f0;border-radius:14px;background:#fff}
    .analytics-sources-details .bing-connect-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 14px;border:1px solid #e5e9f0;border-radius:12px;background:#f8fafc}
    .analytics-sources-details .bing-status{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700}.analytics-sources-details .bing-dot{width:9px;height:9px;border-radius:50%;background:#98a2b3;display:inline-block}.analytics-sources-details .bing-dot.connected{background:#12b76a}
    .analytics-sources-details .bing-actions{display:flex;gap:7px;flex-wrap:wrap}.analytics-sources-details #bingMessage{margin-top:10px}.analytics-sources-details .bing-success{padding:11px 13px;border-radius:10px;background:#ecfdf3;color:#027a48;font-size:11px;line-height:1.8}.analytics-sources-details .bing-error{padding:11px 13px;border-radius:10px;background:#fef3f2;color:#b42318;font-size:11px;line-height:1.8}.analytics-sources-details .bing-help{margin-top:10px;color:#667085;font-size:11px;line-height:1.8}
  `; document.head.appendChild(s); };
  const init=()=>{styles();let n=0;const t=setInterval(()=>{if(setup()||++n>=160)clearInterval(t)},250);setup();};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
