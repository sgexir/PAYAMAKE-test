const CLOUDFLARE_GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";
const WORKER_NAME = "payamake-contact-staging";
const SITE_HOST = "payamake.ir";
const MAX_QUERY_DAYS = 7;

export async function handleCloudflareAnalytics(request, env) {
  const url = new URL(request.url);
  if (request.method !== "GET") return json({ success: false, error: "Method Not Allowed" }, 405);
  const admin = await requireAdminSession(request, env);
  if (!admin) return json({ success: false, error: "احراز هویت لازم است." }, 401);
  const days = [7, 30, 90].includes(Number(url.searchParams.get("days"))) ? Number(url.searchParams.get("days")) : 30;
  if (!env.CLOUDFLARE_ANALYTICS_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) return json({ success:false, error:"Cloudflare Analytics هنوز تنظیم نشده است." },500);
  try {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    if (url.pathname === "/api/admin/analytics/cloudflare/data") {
      const rows = await queryWorkerMetrics(env, start, end);
      const daily = new Map();
      for (const row of rows) {
        const date = String(row?.dimensions?.datetime || "").slice(0,10);
        if (!date) continue;
        const item = daily.get(date) || { date, requests:0, errors:0, subrequests:0, cpuP50:0, cpuP99:0, memoryP50:0, memoryP99:0 };
        item.requests += Number(row?.sum?.requests || 0);
        item.errors += Number(row?.sum?.errors || 0);
        item.subrequests += Number(row?.sum?.subrequests || 0);
        item.cpuP50 = Math.max(item.cpuP50, Number(row?.quantiles?.cpuTimeP50 || 0));
        item.cpuP99 = Math.max(item.cpuP99, Number(row?.quantiles?.cpuTimeP99 || 0));
        item.memoryP50 = Math.max(item.memoryP50, Number(row?.quantiles?.memoryUsageBytesP50 || 0));
        item.memoryP99 = Math.max(item.memoryP99, Number(row?.quantiles?.memoryUsageBytesP99 || 0));
        daily.set(date,item);
      }
      const series = [...daily.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(x=>({...x,errorRate:x.requests?(x.errors/x.requests)*100:0}));
      const summary = series.reduce((a,x)=>({requests:a.requests+x.requests,errors:a.errors+x.errors,subrequests:a.subrequests+x.subrequests,cpuP50:Math.max(a.cpuP50,x.cpuP50),cpuP99:Math.max(a.cpuP99,x.cpuP99),memoryP50:Math.max(a.memoryP50,x.memoryP50),memoryP99:Math.max(a.memoryP99,x.memoryP99)}),{requests:0,errors:0,subrequests:0,cpuP50:0,cpuP99:0,memoryP50:0,memoryP99:0});
      summary.errorRate = summary.requests ? (summary.errors/summary.requests)*100 : 0;
      return json({success:true,days,worker:WORKER_NAME,summary,series,hasData:series.length>0,source:"Cloudflare GraphQL Analytics API"});
    }
    if (url.pathname === "/api/admin/analytics/cloudflare/web/data") {
      const data = await queryWebAnalytics(env, start, end);
      return json({success:true,days,site:SITE_HOST,...data,source:"Cloudflare Web Analytics (RUM) GraphQL API"});
    }
    return json({ success:false, error:"Not Found" },404);
  } catch (error) {
    console.error("Cloudflare analytics failed",error);
    return json({success:false,error:error instanceof Error?error.message:"دریافت آمار Cloudflare انجام نشد."},502);
  }
}

async function queryWebAnalytics(env,start,end){
  const accountTag=String(env.CLOUDFLARE_ACCOUNT_ID).replace(/[^a-zA-Z0-9_-]/g,"");
  const filter=`filter: { datetime_geq: "${start.toISOString()}", datetime_leq: "${end.toISOString()}", requestHost: "${SITE_HOST}" }`;
  const query=`query { viewer { accounts(filter: { accountTag: "${accountTag}" }) { traffic: rumPageloadEventsAdaptiveGroups(limit: 10000, orderBy: [count_DESC], ${filter}) { count dimensions { date requestPath countryName deviceType } sum { visits } } } } }`;
  const response=await fetch(CLOUDFLARE_GRAPHQL_URL,{method:"POST",headers:{Authorization:`Bearer ${env.CLOUDFLARE_ANALYTICS_TOKEN}`,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query})});
  const data=await response.json().catch(()=>null);
  if(!response.ok) throw new Error(data?.errors?.[0]?.message||`Cloudflare API error (${response.status})`);
  if(data?.errors?.length) throw new Error(data.errors.map(x=>x.message).join("; "));
  const rows=data?.data?.viewer?.accounts?.[0]?.traffic||[];
  const dailyMap=new Map(), pages=new Map(), countries=new Map(), devices=new Map();
  for(const row of rows){
    const date=String(row?.dimensions?.date||"").slice(0,10); const views=Number(row?.count||0); const visits=Number(row?.sum?.visits||0);
    if(date){const item=dailyMap.get(date)||{date,pageViews:0,visits:0};item.pageViews+=views;item.visits+=visits;dailyMap.set(date,item);}
    const path=String(row?.dimensions?.requestPath||"").trim(); if(path){const item=pages.get(path)||{path,pageViews:0,visits:0};item.pageViews+=views;item.visits+=visits;pages.set(path,item);}
    const country=String(row?.dimensions?.countryName||"").trim(); if(country){const item=countries.get(country)||{country,pageViews:0,visits:0};item.pageViews+=views;item.visits+=visits;countries.set(country,item);}
    const device=String(row?.dimensions?.deviceType||"").trim(); if(device){const item=devices.get(device)||{device,pageViews:0,visits:0};item.pageViews+=views;item.visits+=visits;devices.set(device,item);}
  }
  const series=[...dailyMap.values()].sort((a,b)=>a.date.localeCompare(b.date));
  return {summary:{pageViews:series.reduce((n,x)=>n+x.pageViews,0),visits:series.reduce((n,x)=>n+x.visits,0)},series,topPages:[...pages.values()].sort((a,b)=>b.pageViews-a.pageViews).slice(0,10),countries:[...countries.values()].sort((a,b)=>b.pageViews-a.pageViews).slice(0,10),devices:[...devices.values()].sort((a,b)=>b.pageViews-a.pageViews).slice(0,6),hasData:series.length>0};
}

async function queryWorkerMetrics(env,start,end){
  const rows=[]; let cursor=new Date(start);
  while(cursor<end){const chunkEnd=new Date(Math.min(cursor.getTime()+MAX_QUERY_DAYS*86400000,end.getTime()));rows.push(...await queryWorkerMetricsChunk(env,cursor,chunkEnd));cursor=chunkEnd;}
  return rows;
}

async function queryWorkerMetricsChunk(env,start,end){
  const accountTag=String(env.CLOUDFLARE_ACCOUNT_ID).replace(/[^a-zA-Z0-9_-]/g,"");
  const query=`query { viewer { accounts(filter: { accountTag: "${accountTag}" }) { workersInvocationsAdaptive(limit: 10000, filter: { datetime_geq: "${start.toISOString()}", datetime_leq: "${end.toISOString()}", scriptName: "${WORKER_NAME}" }) { dimensions { datetime scriptName } sum { requests errors subrequests } quantiles { cpuTimeP50 cpuTimeP99 memoryUsageBytesP50 memoryUsageBytesP99 } } } } }`;
  const response=await fetch(CLOUDFLARE_GRAPHQL_URL,{method:"POST",headers:{Authorization:`Bearer ${env.CLOUDFLARE_ANALYTICS_TOKEN}`,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query})});
  const data=await response.json().catch(()=>null);
  if(!response.ok) throw new Error(data?.errors?.[0]?.message||`Cloudflare API error (${response.status})`);
  if(data?.errors?.length) throw new Error(data.errors.map(x=>x.message).join("; "));
  const account=data?.data?.viewer?.accounts?.[0];
  if(!account) throw new Error("Cloudflare Account Analytics برای این Account ID داده‌ای برنگرداند.");
  return account.workersInvocationsAdaptive||[];
}

async function requireAdminSession(request,env){const token=readCookie(request.headers.get("Cookie"),"payamake_session");if(!token||!env.DB)return null;const tokenHash=await sha256(decodeURIComponent(token));return env.DB.prepare(`SELECT s.admin_id,a.full_name,a.email,a.is_active FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND a.is_active=1 LIMIT 1`).bind(tokenHash).first();}
function readCookie(header,name){for(const item of String(header||"").split(";")){const [key,...rest]=item.trim().split("=");if(key===name)return rest.join("=");}return null;}
async function sha256(value){const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(value)));return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=UTF-8","Cache-Control":"no-store"}});}
