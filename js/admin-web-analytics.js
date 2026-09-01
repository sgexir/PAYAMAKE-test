(() => {
  'use strict';
  let days = 30;
  const $ = (s, root = document) => root.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num = v => new Intl.NumberFormat('fa-IR').format(Math.round(Number(v) || 0));

  function addStyles(){
    if($('#webAnalyticsRuntimeStyles')) return;
    const s=document.createElement('style'); s.id='webAnalyticsRuntimeStyles';
    s.textContent='.web-runtime-card{margin-top:14px!important}.web-runtime-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:14px 0}.web-runtime-ranges{display:flex;gap:6px;flex-wrap:wrap}.web-runtime-ranges button{border:1px solid #d0d5dd;background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;font:inherit;font-size:12px}.web-runtime-ranges button.active{background:#2563eb;color:#fff;border-color:#2563eb}.web-runtime-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.web-runtime-stat{padding:16px;border:1px solid #e5e9f0;border-radius:12px;background:#fff}.web-runtime-stat span{display:block;font-size:11px;color:#667085;margin-bottom:6px}.web-runtime-stat strong{font-size:24px}.web-runtime-chart{margin-top:12px;padding:14px;border:1px solid #e5e9f0;border-radius:12px;background:#fff}.web-runtime-chart h4{margin:0 0 10px;font-size:13px}.web-runtime-chart svg{display:block;width:100%;height:190px}.web-runtime-grid{stroke:#e5e7eb;stroke-width:1}.web-runtime-line{fill:none;stroke:#2563eb;stroke-width:2.5}.web-runtime-visits{fill:none;stroke:#16a34a;stroke-width:2.5}.web-runtime-label{font-size:10px;fill:#667085}.web-runtime-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.web-runtime-panel{padding:14px;border:1px solid #e5e9f0;border-radius:12px;background:#fff}.web-runtime-panel h4{margin:0 0 10px;font-size:13px}.web-runtime-list{display:grid;gap:7px}.web-runtime-row{display:flex;justify-content:space-between;gap:10px;padding:9px 10px;border-radius:8px;background:#f8fafc;font-size:11px}.web-runtime-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.web-runtime-row strong{white-space:nowrap}.web-runtime-loading{padding:24px;text-align:center;color:#667085}.web-runtime-error{padding:14px;border-radius:10px;background:#fef2f2;color:#991b1b;font-size:12px;line-height:1.9}.web-runtime-meta{font-size:11px;color:#667085;margin-top:10px}@media(max-width:800px){.web-runtime-columns{grid-template-columns:1fr}.web-runtime-summary{grid-template-columns:1fr 1fr}}';
    document.head.appendChild(s);
  }

  function chart(series){
    if(!series.length) return '<div class="web-runtime-loading">داده‌ای برای این بازه وجود ندارد.</div>';
    const W=760,H=190,P=24,max=Math.max(1,...series.map(x=>Math.max(Number(x.pageViews)||0,Number(x.visits)||0)));
    const points=(key)=>series.map((x,i)=>{const v=Number(x[key])||0;const px=P+(i/Math.max(series.length-1,1))*(W-P*2);const py=H-P-(v/max)*(H-P*2);return `${px.toFixed(1)},${py.toFixed(1)}`;}).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="24" y1="24" x2="736" y2="24" class="web-runtime-grid"/><line x1="24" y1="95" x2="736" y2="95" class="web-runtime-grid"/><line x1="24" y1="166" x2="736" y2="166" class="web-runtime-grid"/><polyline points="${points('pageViews')}" class="web-runtime-line"/><polyline points="${points('visits')}" class="web-runtime-visits"/><text x="24" y="184" class="web-runtime-label">${esc(series[0].date)}</text><text x="736" y="184" text-anchor="end" class="web-runtime-label">${esc(series[series.length-1].date)}</text></svg><div style="font-size:11px;color:#667085;margin-top:6px">■ Page Views &nbsp;&nbsp; ■ Visits</div>`;
  }

  function list(items,labelKey){
    if(!items?.length) return '<div class="web-runtime-loading">داده‌ای موجود نیست.</div>';
    return `<div class="web-runtime-list">${items.map(x=>`<div class="web-runtime-row"><span>${esc(x[labelKey]||'—')}</span><strong>${num(x.pageViews)}</strong></div>`).join('')}</div>`;
  }

  async function load(){
    const box=$('#webAnalyticsContent'); if(!box)return;
    box.innerHTML='<div class="web-runtime-loading">در حال دریافت آمار بازدید سایت...</div>';
    try{
      const r=await fetch(`/api/admin/analytics/cloudflare/web/data?days=${days}`,{credentials:'include',cache:'no-store'});
      const d=await r.json().catch(()=>({success:false,error:'پاسخ نامعتبر از API'}));
      if(!r.ok||!d.success)throw new Error(d.error||`خطای API (${r.status})`);
      const s=d.summary||{},series=Array.isArray(d.series)?d.series:[];
      box.innerHTML=`<div class="web-runtime-summary"><div class="web-runtime-stat"><span>بازدید صفحات (Page Views)</span><strong>${num(s.pageViews)}</strong></div><div class="web-runtime-stat"><span>Visits</span><strong>${num(s.visits)}</strong></div></div><div class="web-runtime-chart"><h4>روند بازدید سایت</h4>${chart(series)}</div><div class="web-runtime-columns"><div class="web-runtime-panel"><h4>صفحات پربازدید</h4>${list(d.topPages,'path')}</div><div class="web-runtime-panel"><h4>کشورها</h4>${list(d.countries,'country')}</div><div class="web-runtime-panel"><h4>دستگاه‌ها</h4>${list(d.devices,'device')}</div></div><div class="web-runtime-meta">سایت: ${esc(d.site||'payamake.ir')} · منبع: Cloudflare Web Analytics (RUM) · بروزرسانی: ${new Date().toLocaleString('fa-IR')}</div>`;
    }catch(e){box.innerHTML=`<div class="web-runtime-error"><strong>دریافت آمار بازدید سایت ناموفق بود.</strong><br>${esc(e?.message||'خطای نامشخص')}</div>`;}
  }

  function inject(){
    const section=$('#analytics'); if(!section||section.dataset.analyticsReady!=='1')return false;
    addStyles(); if($('#webAnalyticsCard'))return true;
    const card=document.createElement('div'); card.id='webAnalyticsCard'; card.className='sms-section-card web-runtime-card';
    card.innerHTML='<div class="sms-section-title"><div><h3>بازدید و ترافیک سایت</h3><span>آمار واقعی بازدید صفحات و Visits سایت PAYAMAKE.</span></div><button id="webAnalyticsRefresh" class="admin-button outline small" type="button">بروزرسانی</button></div><div class="web-runtime-toolbar"><div class="web-runtime-ranges"><button data-web-days="7" type="button">۷ روز</button><button data-web-days="30" class="active" type="button">۳۰ روز</button><button data-web-days="90" type="button">۹۰ روز</button></div><span>Cloudflare Web Analytics</span></div><div id="webAnalyticsContent" class="web-runtime-loading">در حال آماده‌سازی...</div>';
    const cf=$('#cloudflareAnalyticsCard'); if(cf?.parentNode) cf.insertAdjacentElement('afterend',card); else section.appendChild(card);
    card.querySelectorAll('[data-web-days]').forEach(b=>b.addEventListener('click',()=>{days=Number(b.dataset.webDays)||30;card.querySelectorAll('[data-web-days]').forEach(x=>x.classList.toggle('active',x===b));load();}));
    $('#webAnalyticsRefresh')?.addEventListener('click',load); load(); return true;
  }

  function init(){if(!location.pathname.startsWith('/admin'))return;let tries=0;const timer=setInterval(()=>{tries++;if(inject()||tries>=120)clearInterval(timer);},250);inject();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
