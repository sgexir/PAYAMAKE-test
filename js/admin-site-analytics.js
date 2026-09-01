(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num = v => new Intl.NumberFormat('fa-IR').format(Math.round(Number(v) || 0));
  let days = 30;
  let period = '';

  function addStyles(){
    if($('#siteTrafficAnalyticsStyles')) return;
    const style=document.createElement('style');style.id='siteTrafficAnalyticsStyles';style.textContent=`
      .site-traffic-card{margin-top:14px!important}.site-traffic-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:14px 0}.site-traffic-ranges{display:flex;gap:6px;flex-wrap:wrap}.site-traffic-ranges button{border:1px solid #d0d5dd;background:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;font:inherit;font-size:12px}.site-traffic-ranges button.active{background:#2563eb;color:#fff;border-color:#2563eb}.site-traffic-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.site-traffic-stat{padding:16px;border:1px solid #e5e9f0;border-radius:12px;background:#fff}.site-traffic-stat span{display:block;font-size:11px;color:#667085;margin-bottom:6px}.site-traffic-stat strong{font-size:24px}.site-traffic-chart{margin-top:12px;padding:14px;border:1px solid #e5e9f0;border-radius:12px;background:#fff}.site-traffic-chart h4{margin:0 0 10px;font-size:13px}.site-traffic-line{fill:none;stroke:#2563eb;stroke-width:2.5}.site-traffic-grid{stroke:#e5e7eb;stroke-width:1}.site-traffic-label{font-size:10px;fill:#667085}.site-traffic-loading{padding:24px;text-align:center;color:#667085}.site-traffic-error{padding:14px;border-radius:10px;background:#fef2f2;color:#991b1b;font-size:12px;line-height:1.9}.site-traffic-meta{font-size:11px;color:#667085;margin-top:10px}.site-traffic-note{margin-top:10px;padding:11px 13px;border-radius:10px;background:#f8fafc;color:#667085;font-size:11px;line-height:1.8}.site-traffic-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}.site-traffic-table{overflow:auto;border:1px solid #e5e9f0;border-radius:12px;background:#fff}.site-traffic-table h4{margin:0;padding:13px 14px;border-bottom:1px solid #e5e9f0;font-size:13px}.site-traffic-table table{width:100%;border-collapse:collapse;min-width:420px}.site-traffic-table th,.site-traffic-table td{padding:9px 11px;border-bottom:1px solid #eef1f5;text-align:right;font-size:11px;white-space:nowrap}.site-traffic-table th{background:#f8fafc;color:#667085;font-weight:700}.site-traffic-table tr:last-child td{border-bottom:0}.site-traffic-empty{padding:18px;text-align:center;color:#667085;font-size:11px}@media(max-width:700px){.site-traffic-summary,.site-traffic-grid2{grid-template-columns:1fr}}
    `;document.head.appendChild(style);
  }

  function chart(series){
    if(!series.length)return '<div class="site-traffic-loading">هنوز داده‌ای برای این بازه وجود ندارد.</div>';
    const values=series.map(x=>Number(x.pageViews)||0),W=760,H=190,P=24,max=Math.max(...values,1);
    const points=values.map((v,i)=>{const x=P+(i/Math.max(values.length-1,1))*(W-P*2),y=H-P-(v/max)*(H-P*2);return `${x.toFixed(1)},${y.toFixed(1)}`;}).join(' ');
    return `<svg viewBox="0 0 760 190" preserveAspectRatio="none" style="display:block;width:100%;height:190px"><line x1="24" y1="24" x2="736" y2="24" class="site-traffic-grid"/><line x1="24" y1="95" x2="736" y2="95" class="site-traffic-grid"/><line x1="24" y1="166" x2="736" y2="166" class="site-traffic-grid"/><polyline points="${points}" class="site-traffic-line"/><text x="24" y="184" class="site-traffic-label">${esc(series[0].date)}</text><text x="736" y="184" text-anchor="end" class="site-traffic-label">${esc(series[series.length-1].date)}</text></svg>`;
  }

  function table(title, rows, columns){
    if(!Array.isArray(rows)||!rows.length)return `<div class="site-traffic-table"><h4>${esc(title)}</h4><div class="site-traffic-empty">داده‌ای موجود نیست.</div></div>`;
    return `<div class="site-traffic-table"><h4>${esc(title)}</h4><table><thead><tr>${columns.map(c=>`<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${columns.map(c=>`<td>${esc(c.format?c.format(row):row[c.key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  async function load(card){
    const box=$('#siteTrafficContent',card);if(!box)return;
    box.innerHTML='<div class="site-traffic-loading">در حال دریافت آمار واقعی بازدید سایت...</div>';
    try{
      const query=period?`period=${encodeURIComponent(period)}`:`days=${days}`;
      const response=await fetch(`/api/admin/analytics/cloudflare/web/data?${query}`,{credentials:'include',cache:'no-store'});
      const data=await response.json().catch(()=>({success:false,error:'پاسخ نامعتبر از API'}));
      if(!response.ok||!data.success)throw new Error(data.error||`خطای API (${response.status})`);
      const s=data.summary||{},series=Array.isArray(data.series)?data.series:[];
      box.innerHTML=`<div class="site-traffic-summary"><div class="site-traffic-stat"><span>Page Views</span><strong>${num(s.pageViews)}</strong></div><div class="site-traffic-stat"><span>Visits</span><strong>${num(s.visits)}</strong></div></div><div class="site-traffic-chart"><h4>روند بازدید صفحات</h4>${chart(series)}</div><div class="site-traffic-grid2">${table('کشورها',[...(data.countries||[])],[{label:'کشور',key:'country'},{label:'Page Views',key:'pageViews',format:num},{label:'Visits',key:'visits',format:num}])}${table('صفحات پربازدید',[...(data.topPages||[])],[{label:'مسیر صفحه',key:'path'},{label:'Page Views',key:'pageViews',format:num},{label:'Visits',key:'visits',format:num}])}</div><div class="site-traffic-grid2">${table('دستگاه‌ها',[...(data.devices||[])],[{label:'دستگاه',key:'device'},{label:'Page Views',key:'pageViews',format:num}])}${table('مرورگرها',[...(data.browsers||[])],[{label:'مرورگر',key:'browser'},{label:'Page Views',key:'pageViews',format:num}])}</div><div class="site-traffic-grid2">${table('سیستم‌عامل‌ها',[...(data.operatingSystems||[])],[{label:'سیستم‌عامل',key:'os'},{label:'Page Views',key:'pageViews',format:num}])}${table('منابع ورود / Referrer Path',[...(data.referrers||[])],[{label:'مسیر ارجاع',key:'referrer'},{label:'Page Views',key:'pageViews',format:num}])}</div><div class="site-traffic-note">این بخش ترافیک واقعی کاربران سایت را از Cloudflare HTTP Analytics (Eyeball Traffic) نمایش می‌دهد و از آمار Worker جداست. IP خام کاربر نمایش داده نمی‌شود.</div><div class="site-traffic-meta">سایت: ${esc(data.site||'payamake.ir')} · منبع: Cloudflare HTTP Analytics · بروزرسانی: ${new Date().toLocaleString('fa-IR')}</div>`;
    }catch(error){box.innerHTML=`<div class="site-traffic-error"><strong>دریافت آمار بازدید سایت ناموفق بود.</strong><br>${esc(error?.message||'خطای نامشخص')}</div>`;}
  }

  function inject(){
    const section=$('#analytics');if(!section||section.dataset.analyticsReady!=='1')return false;if($('#siteTrafficAnalyticsCard'))return true;addStyles();
    const card=document.createElement('div');card.id='siteTrafficAnalyticsCard';card.className='sms-section-card site-traffic-card';
    card.innerHTML='<div class="sms-section-title"><div><h3>بازدید و ترافیک واقعی سایت</h3><span>آمار بازدیدکنندگان، Page Views و رفتار کاربران PAYAMAKE، جدا از آمار Worker.</span></div><button id="siteTrafficRefresh" class="admin-button outline small" type="button">بروزرسانی</button></div><div class="site-traffic-toolbar"><div class="site-traffic-ranges"><button data-site-period="today" type="button">امروز</button><button data-site-period="yesterday" type="button">دیروز</button><button data-site-days="7" type="button">۷ روز</button><button data-site-days="30" class="active" type="button">۳۰ روز</button><button data-site-days="90" type="button">۹۰ روز</button><button data-site-days="180" type="button">۱۸۰ روز</button></div><span>ترافیک واقعی سایت</span></div><div id="siteTrafficContent" class="site-traffic-loading">در حال آماده‌سازی...</div>';
    section.appendChild(card);
    card.querySelectorAll('[data-site-days]').forEach(button=>button.addEventListener('click',()=>{period='';days=Number(button.dataset.siteDays)||30;card.querySelectorAll('[data-site-days], [data-site-period]').forEach(x=>x.classList.toggle('active',x===button));load(card);}));
    card.querySelectorAll('[data-site-period]').forEach(button=>button.addEventListener('click',()=>{period=button.dataset.sitePeriod;card.querySelectorAll('[data-site-days], [data-site-period]').forEach(x=>x.classList.toggle('active',x===button));load(card);}));
    $('#siteTrafficRefresh',card)?.addEventListener('click',()=>load(card));load(card);return true;
  }

  function init(){if(!location.pathname.startsWith('/admin'))return;let tries=0;const timer=setInterval(()=>{tries+=1;if(inject()||tries>=120)clearInterval(timer);},250);inject();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
