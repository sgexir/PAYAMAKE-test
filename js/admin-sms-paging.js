(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
  const label = p => p === 'lead_customer' ? 'پیامک مشتری' : p === 'lead_admin' ? 'پیامک مدیر' : p;
  const status = v => `<span class="sms-status ${esc(v)}">${({sent:'ارسال شده',failed:'ناموفق',pending:'در انتظار',delivered:'دلیور شده',unknown:'نامشخص',expired:'منقضی'}[v] || esc(v || '—'))}</span>`;
  const pageUi = (pages, page) => {
    if (pages <= 1) return '';
    const a=[]; const add=n=>a.push(`<button type="button" class="sms-pagination-button${n===page?' active':''}" data-page="${n}">${n}</button>`); const dots=()=>a.push('<span class="sms-pagination-dots">…</span>');
    if(pages<=7){for(let i=1;i<=pages;i++)add(i);} else {add(1); if(page>4)dots(); for(let i=Math.max(2,page-1);i<=Math.min(pages-1,page+1);i++)add(i); if(page<pages-3)dots(); add(pages);}
    return `<div class="sms-pagination" role="navigation" aria-label="صفحه‌بندی"><button type="button" class="sms-pagination-button nav" data-page="${Math.max(1,page-1)}" ${page<=1?'disabled':''}>قبلی</button>${a.join('')}<button type="button" class="sms-pagination-button nav" data-page="${Math.min(pages,page+1)}" ${page>=pages?'disabled':''}>بعدی</button></div>`;
  };
  async function load(page=1, notify=false) {
    const box=$('#logsTable'); if(!box) return;
    box.innerHTML='<div class="sms-loading">در حال دریافت لاگ‌ها...</div>';
    try {
      const q=new URLSearchParams({pageSize:'20',page:String(page)}); const p=$('#logProvider')?.value; const s=$('#logStatus')?.value; if(p)q.set('provider',p); if(s)q.set('status',s);
      const r=await fetch(`/api/admin/sms/logs?${q}`,{credentials:'include'}); const d=await r.json(); if(r.status===401){location.href='/admin/login.html';return;} if(!r.ok||d.success===false)throw new Error(d.error||'خطای سرور');
      const rows=d.logs||[]; const info=d.pagination||{page:page,totalPages:1,total:rows.length};
      if(!rows.length){box.innerHTML='<div class="sms-empty">برای فیلتر فعلی لاگی ثبت نشده است.</div>';return;}
      box.innerHTML=`<table class="admin-table sms-logs-table"><thead><tr><th>ID</th><th>زمان</th><th>Lead</th><th>Provider</th><th>نوع</th><th>مقصد</th><th>ارسال</th><th>Delivery</th><th>Template</th><th>Sender</th><th>Provider Code</th><th>Message ID</th><th>جزئیات</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.id)}</td><td>${esc(r.created_at)}</td><td>${esc(r.lead_id||'—')}</td><td>${esc(r.provider_name||r.provider_key)}</td><td>${esc(label(r.purpose))}</td><td dir="ltr">${esc(r.recipient)}</td><td>${status(r.send_status)}</td><td>${status(r.delivery_status)}</td><td>${esc(r.template_id||'—')}</td><td dir="ltr">${esc(r.sender||'—')}</td><td dir="ltr">${esc(r.provider_code||r.provider_status||'—')}</td><td dir="ltr">${esc(r.provider_message_id||'—')}</td><td><details><summary>${r.error_message?'خطا':'مشاهده'}</summary><div class="sms-log-detail"><strong>${r.error_message?'خطا':'پاسخ Provider'}</strong><pre>${esc(r.error_message||r.provider_response||'—')}</pre>${r.message?`<strong>پیام</strong><pre>${esc(r.message)}</pre>`:''}</div></details></td></tr>`).join('')}</tbody></table>${pageUi(info.totalPages,info.page)}${notify?`<div class="sms-pagination-summary">${info.total} لاگ</div>`:''}`;
      box.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>load(Number(b.dataset.page)));
    } catch(e) { box.innerHTML=`<div class="sms-empty">${esc(e.message)}</div>`; }
  }
  function loadLeadModule(){
    if(window.loadPayamakeLeads || document.querySelector('script[data-payamake-leads]')) return;
    const s=document.createElement('script');
    s.src='../js/admin-leads.js';
    s.dataset.payamakeLeads='1';
    document.head.appendChild(s);
  }
  document.addEventListener('DOMContentLoaded',()=>{
    if(location.pathname!=='/admin/'&&location.pathname!=='/admin/index.html')return;
    loadLeadModule();
    const refresh=()=>load(1,false);
    $('#refreshLogs')?.addEventListener('click',()=>load(1,true));
    $('#logProvider')?.addEventListener('change',refresh); $('#logStatus')?.addEventListener('change',refresh);
    const tab=document.querySelector('.sms-tab[data-tab="logs"]'); if(tab) tab.addEventListener('click',()=>setTimeout(()=>load(1,false),0));
  });
})();
