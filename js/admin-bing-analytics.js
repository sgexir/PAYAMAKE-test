(() => {
  const state = { days: 30, loading: false };
  const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const num = v => new Intl.NumberFormat('fa-IR').format(Number(v) || 0);
  const date = v => { const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v || '') : d.toLocaleDateString('fa-IR',{month:'short',day:'numeric'}); };
  function render(data) {
    const s = data.summary || {};
    const summary = document.getElementById('bingAnalyticsSummary');
    if (summary) summary.innerHTML = [['کلیک',num(s.clicks)],['نمایش',num(s.impressions)],['CTR',`${Number(s.ctr||0).toFixed(1)}%`],['میانگین رتبه',Number(s.avgPosition||0).toFixed(1)]].map(x=>`<div class="bing-metric"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
    const rows = Array.isArray(data.traffic) ? data.traffic : [];
    const chart = document.getElementById('bingTrafficChart');
    if (chart) {
      if (!rows.length) chart.innerHTML='<div class="analytics-empty">هنوز داده‌ای از Bing برای این بازه دریافت نشده است.</div>';
      else { const max=Math.max(1,...rows.map(r=>Math.max(Number(r.clicks)||0,Number(r.impressions)||0))); chart.innerHTML=`<div class="bing-chart">${rows.slice(-30).map(r=>`<div class="bing-chart-col"><div class="bing-bars"><i style="height:${Math.max(4,(Number(r.impressions)||0)/max*100)}%" title="نمایش: ${num(r.impressions)}"></i><b style="height:${Math.max(4,(Number(r.clicks)||0)/max*100)}%" title="کلیک: ${num(r.clicks)}"></b></div><span>${esc(date(r.date))}</span></div>`).join('')}</div><div class="bing-legend"><span>■ نمایش</span><span>■ کلیک</span></div>`; }
    }
    const q = document.getElementById('bingQueriesTable');
    const queries = Array.isArray(data.queries) ? data.queries.slice(0,10) : [];
    if (q) q.innerHTML = queries.length ? `<div class="table-wrap"><table><thead><tr><th>کلمه کلیدی</th><th>کلیک</th><th>نمایش</th><th>CTR</th><th>رتبه</th></tr></thead><tbody>${queries.map(r=>`<tr><td>${esc(r.query)}</td><td>${num(r.clicks)}</td><td>${num(r.impressions)}</td><td>${Number(r.ctr||0).toFixed(1)}%</td><td>${Number(r.position||0).toFixed(1)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="analytics-empty">داده کلمات کلیدی در دسترس نیست.</div>';
    const c = data.crawl?.[data.crawl.length-1] || {};
    const crawl = document.getElementById('bingCrawlStats');
    if (crawl) crawl.innerHTML=[['در ایندکس',c.inIndex],['صفحات Crawl شده',c.crawledPages],['خطاهای Crawl',c.crawlErrors],['پاسخ 4xx',c.code4xx],['پاسخ 5xx',c.code5xx]].map(x=>`<div class="bing-crawl-item"><span>${x[0]}</span><strong>${num(x[1])}</strong></div>`).join('');
    const site=document.getElementById('bingAnalyticsSite'); if(site) site.textContent=data.siteUrl||'—';
    const updated=document.getElementById('bingAnalyticsUpdated'); if(updated) updated.textContent=`آخرین بروزرسانی: ${new Date().toLocaleString('fa-IR')}`;
  }
  async function load(){
    if(state.loading)return; state.loading=true;
    const b=document.getElementById('refreshBingAnalytics'), m=document.getElementById('bingAnalyticsMessage');
    if(b){b.disabled=true;b.textContent='در حال دریافت...';} if(m)m.textContent='';
    try{const r=await fetch(`/api/admin/analytics/bing/data?days=${state.days}`,{credentials:'include'});const d=await r.json();if(!r.ok||!d.success)throw new Error(d.error||'دریافت آمار Bing انجام نشد.');render(d);}
    catch(e){if(m)m.textContent=e.message||'خطا در دریافت آمار Bing.';}
    finally{state.loading=false;if(b){b.disabled=false;b.textContent='بروزرسانی';}}
  }
  window.initBingAnalytics=()=>{const b=document.getElementById('refreshBingAnalytics'),s=document.getElementById('bingAnalyticsDays');if(b)b.onclick=load;if(s)s.onchange=()=>{state.days=Number(s.value)||30;load();};load();};
})();
