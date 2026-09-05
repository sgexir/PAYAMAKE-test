(()=>{
'use strict';

const PAGE_SIZE=20;
const state={query:{activity:'',ips:'',audit:''},page:{activity:1,ips:1,audit:1}};
let modal=null;
let currentAdminId=0;
let initialized=false;

const esc=(value)=>String(value??'').replace(/[&<>"']/g,(char)=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
}[char]));

async function api(path,options={}){
  const response=await fetch(path,{
    credentials:'include',
    ...options,
    headers:{'Content-Type':'application/json',...(options.headers||{})}
  });
  const data=await response.json().catch(()=>({error:'پاسخ نامعتبر'}));
  if(response.status===401){
    location.href='/admin/login';
    throw new Error('احراز هویت لازم است.');
  }
  if(!response.ok||data.success===false) throw new Error(data.error||'خطای سرور');
  return data;
}

function browserInfo(userAgent){
  const ua=String(userAgent||'');
  let browser='مرورگر نامشخص';
  let os='سیستم‌عامل نامشخص';
  let device='دسکتاپ';
  if(/Edg\//i.test(ua)) browser='Microsoft Edge';
  else if(/OPR\//i.test(ua)) browser='Opera';
  else if(/Firefox\//i.test(ua)) browser='Mozilla Firefox';
  else if(/Chrome\//i.test(ua)) browser='Google Chrome';
  else if(/Safari\//i.test(ua)) browser='Safari';
  if(/Windows NT/i.test(ua)) os='Windows';
  else if(/Mac OS X/i.test(ua)) os='macOS';
  else if(/Android/i.test(ua)) os='Android';
  else if(/iPhone|iPad|iPod/i.test(ua)) os='iOS';
  else if(/Linux/i.test(ua)) os='Linux';
  if(/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) device='موبایل/تبلت';
  return `${browser} · ${os} · ${device}`;
}

function matches(row,query){
  if(!query) return true;
  const needle=String(query).toLocaleLowerCase('fa');
  return Object.values(row||{}).some((value)=>String(value??'').toLocaleLowerCase('fa').includes(needle));
}

function searchBox(key,placeholder){
  return `<div class="security-search-wrap"><input class="security-search" data-search="${key}" placeholder="${placeholder}" value="${esc(state.query[key]||'')}"></div>`;
}

function paginate(rows,key,renderer){
  const filtered=rows.filter((row)=>matches(row,state.query[key]));
  const totalPages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const page=Math.min(state.page[key],totalPages);
  const start=(page-1)*PAGE_SIZE;
  let html=filtered.slice(start,start+PAGE_SIZE).map(renderer).join('');
  if(totalPages>1){
    html+=`<div class="security-pager"><button data-pager="${key}" data-dir="-1" ${page<=1?'disabled':''}>قبلی</button><span>صفحه ${page} از ${totalPages} · ${filtered.length} رکورد</span><button data-pager="${key}" data-dir="1" ${page>=totalPages?'disabled':''}>بعدی</button></div>`;
  }
  return html;
}

function injectStyles(){
  if(document.getElementById('securityCenterStyles')) return;
  const style=document.createElement('style');
  style.id='securityCenterStyles';
  style.textContent=`
.security-account-button{width:42px;min-width:42px;padding:0;font-size:19px;display:inline-flex;align-items:center;justify-content:center}
.security-modal{position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.48);display:none;align-items:center;justify-content:center;padding:18px}
.security-modal.open{display:flex}
.security-modal-card{width:min(1100px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 80px rgba(15,23,42,.24);padding:22px;direction:rtl}
.security-modal-head{display:flex;align-items:center;justify-content:space-between}
.security-modal-close{border:0;background:#f3f4f6;border-radius:9px;width:38px;height:38px;cursor:pointer;font-size:20px}
.security-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}
.security-tabs button,.security-actions button,.security-pager button{border:1px solid #ddd;background:#fff;border-radius:9px;padding:8px 11px;cursor:pointer;font:inherit}
.security-tabs button.active{background:#111;color:#fff}
.security-table{width:100%;border-collapse:collapse;font-size:13px}
.security-table th,.security-table td{padding:9px;border-bottom:1px solid #eee;text-align:right;vertical-align:top}
.security-actions{display:flex;gap:6px;flex-wrap:wrap}
.security-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:16px}
.security-form input,.security-search{padding:9px;border:1px solid #ddd;border-radius:8px;font:inherit;width:100%;box-sizing:border-box}
.security-form button{border:0;border-radius:8px;padding:9px 13px;background:#111;color:#fff;cursor:pointer;font:inherit}
.security-note{padding:10px;background:#f7f7f7;border-radius:10px;margin-bottom:14px;font-size:13px}
.security-search-wrap{margin:10px 0 14px;max-width:620px}
.security-pager{display:flex;align-items:center;justify-content:center;gap:12px;padding:14px 0}
.security-pager button:disabled{opacity:.45;cursor:not-allowed}
.security-badge{display:inline-block;padding:3px 7px;border-radius:999px;background:#f1f5f9;font-size:11px;margin-top:4px}
.security-empty{padding:18px;text-align:center;color:#667085}
.security-copy-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin:12px 0;font-family:ui-monospace,monospace;white-space:pre-wrap;direction:ltr;text-align:left}
.security-modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
.security-modal-actions button{border:1px solid #ddd;border-radius:8px;padding:8px 12px;cursor:pointer;font:inherit}
.security-modal-actions .primary{background:#111;color:#fff}
.security-danger{background:#fff7ed!important;border:1px solid #fed7aa!important}
@media(max-width:700px){.security-modal{padding:8px}.security-modal-card{padding:15px}.security-table{font-size:12px;display:block;overflow:auto;white-space:nowrap}}
`;
  document.head.appendChild(style);
}

function showRecoveryCodes(codes){
  const text=(codes||[]).join('\n');
  const overlay=document.createElement('div');
  overlay.className='security-modal open';
  overlay.innerHTML=`<div class="security-modal-card" style="max-width:620px"><h3>کدهای بازیابی جدید</h3><div class="security-note security-danger"><b>هشدار امنیتی:</b> این کدها فقط برای بازیابی حساب هستند. آن‌ها را در محل امن نگهداری کنید و در اختیار هیچ شخص دیگری قرار ندهید.</div><div class="security-copy-box">${esc(text)}</div><div class="security-modal-actions"><button class="primary" data-copy-recovery>کپی کدها</button><button data-close-recovery>بستن</button></div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('[data-copy-recovery]').onclick=async()=>{
    try{
      await navigator.clipboard.writeText(text);
      overlay.querySelector('[data-copy-recovery]').textContent='کپی شد ✓';
    }catch(_error){
      alert('کپی خودکار مجاز نیست؛ کدها را از کادر انتخاب و کپی کنید.');
    }
  };
  overlay.querySelector('[data-close-recovery]').onclick=()=>overlay.remove();
}

async function render(tab){
  const pane=modal?.querySelector('#securityPane');
  if(!pane) return;
  modal.querySelectorAll('[data-tab]').forEach((button)=>button.classList.toggle('active',button.dataset.tab===tab));
  pane.innerHTML='در حال بارگذاری...';
  try{
    if(tab==='admins'){
      const data=await api('/api/admin/security/admins');
      const admins=data.admins||[];
      pane.innerHTML=`<div class="security-note"><b>مدیر اصلی (Main Admin):</b> حساب اصلی سیستم. <b>مدیر دفاعی (Defense Admin):</b> حساب مستقل برای دسترسی اضطراری و کنترل امنیت. فرم زیر فقط برای ایجاد مدیر دفاعی است.</div><form id="newAdmin" class="security-form"><input name="fullName" placeholder="نام کامل مدیر دفاعی" required><input name="username" placeholder="نام کاربری مدیر دفاعی" required><input name="email" type="email" placeholder="ایمیل مدیر دفاعی" required><input name="password" type="password" placeholder="رمز عبور مدیر دفاعی؛ حداقل ۱۲ کاراکتر" required><button>ایجاد مدیر دفاعی</button></form><table class="security-table"><thead><tr><th>حساب</th><th>نوع حساب</th><th>وضعیت</th><th>MFA</th><th>نشست</th><th>عملیات</th></tr></thead><tbody>${admins.map((admin)=>{
        const isMain=admin.account_type==='main'||admin.username==='main-admin';
        const isSelf=Number(admin.id)===currentAdminId;
        const toggle=isSelf?'':`<button data-action="${admin.is_active?'disable':'enable'}" data-id="${admin.id}">${admin.is_active?'غیرفعال کردن':'فعال کردن'}</button>`;
        return `<tr><td><b>${esc(admin.username)}</b><br>${esc(admin.full_name)}${isSelf?'<br><span class="security-badge">حساب فعلی</span>':''}</td><td>${isMain?'مدیر اصلی (Main Admin)':'مدیر دفاعی (Defense Admin)'}</td><td>${admin.is_active?'فعال':'غیرفعال'}</td><td>${admin.mfa_enabled?'فعال':'تنظیم نشده'}</td><td>${esc(admin.active_sessions)}</td><td><div class="security-actions">${toggle}<button data-action="revoke-all" data-id="${admin.id}">خروج همه نشست‌ها</button><button data-action="reset_mfa" data-id="${admin.id}">Reset MFA</button><button data-action="reset_recovery" data-id="${admin.id}">Reset Recovery</button><button data-action="reset_password" data-id="${admin.id}">تغییر رمز</button></div></td></tr>`;
      }).join('')}</tbody></table>`;
      pane.querySelector('#newAdmin').onsubmit=async(event)=>{
        event.preventDefault();
        try{
          await api('/api/admin/security/admins',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(event.target)))});
          await render('admins');
        }catch(error){alert(error.message);}
      };
      return;
    }

    if(tab==='sessions'){
      const data=await api('/api/admin/security/sessions');
      const rows=data.sessions||[];
      pane.innerHTML=rows.length?`<table class="security-table"><thead><tr><th>حساب</th><th>IP</th><th>مرورگر / سیستم‌عامل</th><th>زمان ایجاد</th><th>انقضا</th><th>User-Agent کامل</th><th>عملیات</th></tr></thead><tbody>${rows.map((row)=>`<tr><td>${esc(row.username)}<br>${esc(row.full_name)}</td><td dir="ltr">${esc(row.ip_address)}</td><td><b>${esc(browserInfo(row.user_agent))}</b></td><td>${esc(row.created_at)}</td><td>${esc(row.expires_at)}</td><td dir="ltr" style="max-width:360px;white-space:normal;word-break:break-word">${esc(row.user_agent)}</td><td><button data-session="${esc(row.id)}">لغو نشست</button></td></tr>`).join('')}</tbody></table>`:'<div class="security-empty">نشست فعالی وجود ندارد.</div>';
      pane.querySelectorAll('[data-session]').forEach((button)=>button.onclick=async()=>{
        try{
          await api('/api/admin/security/sessions/revoke',{method:'POST',body:JSON.stringify({sessionId:button.dataset.session})});
          await render('sessions');
        }catch(error){alert(error.message);}
      });
      return;
    }

    if(tab==='activity'){
      const data=await api('/api/admin/security/login-activity?limit=200');
      const rows=data.activity||[];
      pane.innerHTML=searchBox('activity','جستجو در همه ستون‌های فعالیت ورود')+`<table class="security-table"><thead><tr><th>زمان</th><th>حساب / شناسه</th><th>مرحله</th><th>نتیجه</th><th>IP</th><th>دلیل</th><th>مرورگر / سیستم‌عامل</th></tr></thead><tbody>${paginate(rows,'activity',(row)=>`<tr><td>${esc(row.created_at)}</td><td>${esc(row.username||row.login_identifier)}</td><td>${esc(row.stage)}</td><td>${row.success?'موفق':'ناموفق'}</td><td dir="ltr">${esc(row.ip_address)}</td><td>${esc(row.failure_reason)}</td><td>${esc(browserInfo(row.user_agent))}</td></tr>`)}</tbody></table>`;
      return;
    }

    if(tab==='ips'){
      const data=await api('/api/admin/security/ip-blocklist');
      const rows=data.blocks||[];
      pane.innerHTML=`<form id="ipForm" class="security-form"><input name="ip" placeholder="آدرس IP" required><input name="reason" placeholder="دلیل مسدودسازی"><button>مسدود کردن IP</button></form>`+searchBox('ips','جستجو در همه ستون‌های مدیریت IP')+`<table class="security-table"><thead><tr><th>IP</th><th>دلیل</th><th>زمان مسدودسازی</th><th>زمان رفع مسدودی</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>${paginate(rows,'ips',(row)=>`<tr><td dir="ltr">${esc(row.ip_address)}</td><td>${esc(row.reason)}</td><td>${esc(row.blocked_at)}</td><td>${esc(row.unblocked_at||'—')}</td><td>${row.unblocked_at?'رفع مسدودی':'مسدود'}</td><td>${row.unblocked_at?'—':`<button data-unblock="${esc(row.ip_address)}">رفع مسدودی</button>`}</td></tr>`)}</tbody></table>`;
      pane.querySelector('#ipForm').onsubmit=async(event)=>{
        event.preventDefault();
        const form=new FormData(event.target);
        try{
          await api('/api/admin/security/ip-blocklist',{method:'POST',body:JSON.stringify({action:'block',ip:form.get('ip'),reason:form.get('reason')})});
          await render('ips');
        }catch(error){alert(error.message);}
      };
      pane.querySelectorAll('[data-unblock]').forEach((button)=>button.onclick=async()=>{
        try{
          await api('/api/admin/security/ip-blocklist',{method:'POST',body:JSON.stringify({action:'unblock',ip:button.dataset.unblock})});
          await render('ips');
        }catch(error){alert(error.message);}
      });
      return;
    }

    if(tab==='audit'){
      const data=await api('/api/admin/security/audit?limit=200');
      const rows=data.audit||[];
      pane.innerHTML=searchBox('audit','جستجو در همه ستون‌های لاگ امنیتی')+`<table class="security-table"><thead><tr><th>زمان</th><th>اجراکننده</th><th>عملیات</th><th>هدف</th><th>IP</th><th>جزئیات</th></tr></thead><tbody>${paginate(rows,'audit',(row)=>`<tr><td>${esc(row.created_at)}</td><td>${esc(row.actor_username)}</td><td>${esc(row.action)}</td><td>${esc(row.target_username)}</td><td dir="ltr">${esc(row.ip_address)}</td><td>${esc(row.details_json)}</td></tr>`)}</tbody></table>`;
      return;
    }
  }catch(error){
    pane.innerHTML=`<div class="security-note">${esc(error.message||'خطا در دریافت اطلاعات')}</div>`;
  }
}

function bind(){
  const card=document.getElementById('securityCenterCard');
  const button=document.getElementById('securityAccountButton');
  const open=()=>{
    if(!modal) return;
    modal.classList.add('open');
    render('admins');
  };
  if(card) card.onclick=(event)=>{event.preventDefault();open();};
  if(button) button.onclick=open;
}

function init(){
  if(initialized) return true;
  const actions=document.querySelector('.admin-header-actions');
  if(!actions) return false;
  initialized=true;
  injectStyles();

  let button=document.getElementById('securityAccountButton');
  if(!button){
    button=document.createElement('button');
    button.id='securityAccountButton';
    button.type='button';
    button.className='logout-button security-account-button';
    button.title='حساب و امنیت';
    button.textContent='👤';
    actions.insertBefore(button,actions.querySelector('#logoutButton'));
  }

  modal=document.createElement('div');
  modal.className='security-modal';
  modal.innerHTML=`<div class="security-modal-card" role="dialog" aria-modal="true"><div class="security-modal-head"><h2>حساب و امنیت</h2><button class="security-modal-close" type="button">×</button></div><div class="security-note">مدیریت مدیران، نشست‌ها، فعالیت ورود، IPها و لاگ امنیتی</div><div class="security-tabs"><button data-tab="admins">مدیریت مدیران</button><button data-tab="sessions">نشست‌های فعال</button><button data-tab="activity">فعالیت ورود</button><button data-tab="ips">مدیریت IP</button><button data-tab="audit">لاگ امنیتی</button></div><div id="securityPane">در حال بارگذاری...</div></div>`;
  document.body.appendChild(modal);

  api('/api/admin/me').then((data)=>{currentAdminId=Number(data.admin?.id||0);}).catch(()=>{});
  modal.querySelector('.security-modal-close').onclick=()=>modal.classList.remove('open');
  modal.addEventListener('click',(event)=>{if(event.target===modal) modal.classList.remove('open');});
  modal.querySelectorAll('[data-tab]').forEach((tabButton)=>tabButton.onclick=()=>render(tabButton.dataset.tab));

  const pane=modal.querySelector('#securityPane');
  pane.addEventListener('click',async(event)=>{
    const pager=event.target.closest('[data-pager]');
    if(pager){
      const key=pager.dataset.pager;
      state.page[key]=Math.max(1,state.page[key]+Number(pager.dataset.dir));
      await render(key);
      return;
    }
    const actionButton=event.target.closest('[data-action]');
    if(!actionButton) return;
    const id=Number(actionButton.dataset.id);
    const action=actionButton.dataset.action;
    try{
      if(action==='revoke-all'){
        if(!confirm('همه نشست‌های این حساب فوراً لغو می‌شوند. ادامه می‌دهید؟')) return;
        const result=await api('/api/admin/security/sessions/revoke-all',{method:'POST',body:JSON.stringify({adminId:id})});
        if(id===currentAdminId){
          alert(`همه ${result.revoked||0} نشست شما لغو شد.`);
          location.href='/admin/login';
          return;
        }
      }else if(action==='reset_mfa'){
        if(!confirm('Reset MFA روش‌های MFA و کدهای بازیابی این حساب را حذف و همه نشست‌های آن را لغو می‌کند. بعد از آن باید MFA دوباره راه‌اندازی شود. ادامه می‌دهید؟')) return;
        await api('/api/admin/security/admins/action',{method:'POST',body:JSON.stringify({adminId:id,action})});
        alert('MFA ریست شد. این حساب در ورود بعدی باید MFA را دوباره راه‌اندازی و تأیید کند.');
        if(id===currentAdminId){location.href='/admin/login';return;}
      }else{
        const body={adminId:id,action};
        if(action==='reset_password'){
          const password=prompt('رمز عبور جدید؛ حداقل ۱۲ کاراکتر:');
          if(!password) return;
          body.password=password;
        }
        const result=await api('/api/admin/security/admins/action',{method:'POST',body:JSON.stringify(body)});
        if(result.recoveryCodes) showRecoveryCodes(result.recoveryCodes);
      }
      await render('admins');
    }catch(error){alert(error.message);}
  });

  pane.addEventListener('input',(event)=>{
    const key=event.target.dataset.search;
    if(!key) return;
    state.query[key]=event.target.value;
    state.page[key]=1;
    render(key);
  });

  bind();
  return true;
}

function boot(){
  if(!init()) setTimeout(boot,100);
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();

setTimeout(()=>{
  const observer=new MutationObserver(bind);
  if(document.body) observer.observe(document.body,{childList:true,subtree:true});
},500);
})();
