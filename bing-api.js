const BING_AUTHORIZE_URL = "https://www.bing.com/webmasters/OAuth/authorize";
const BING_TOKEN_URL = "https://www.bing.com/webmasters/oauth/token";
const BING_API_BASE = "https://ssl.bing.com/webmaster/api.svc/json/";
const REDIRECT_PATH = "/api/admin/analytics/bing/callback";

export async function handleBingApi(request, env) {
  if (!env.DB) return json({ success:false, error:"Database is not configured." },500);
  const url=new URL(request.url), path=url.pathname;
  if(request.method==='GET' && path===REDIRECT_PATH) return oauthCallback(request,env,url);
  const admin=await requireAdminSession(request,env);
  if(!admin) return json({success:false,error:"احراز هویت لازم است."},401);
  if(request.method==='GET' && path==='/api/admin/analytics/bing/connect') return startOAuth(request,env,admin);
  if(request.method==='GET' && path==='/api/admin/analytics/bing/status') return connectionStatus(env,admin.admin_id);
  if(request.method==='GET' && path==='/api/admin/analytics/bing/data') return analyticsData(env,admin.admin_id,Number(url.searchParams.get('days'))||30);
  if(request.method==='GET' && path==='/api/admin/analytics/bing/sites') return getSites(env,admin.admin_id);
  if(request.method==='POST' && path==='/api/admin/analytics/bing/disconnect') { await env.DB.prepare('DELETE FROM bing_webmaster_connections WHERE admin_id=?').bind(admin.admin_id).run(); return json({success:true,connected:false}); }
  return json({success:false,error:'Not Found'},404);
}

async function startOAuth(request,env,admin){
  const clientId=String(env.BING_WEBMASTER_CLIENT_ID||'').trim();
  if(!clientId)return json({success:false,error:'BING_WEBMASTER_CLIENT_ID تنظیم نشده است.'},500);
  const state=crypto.randomUUID(), stateHash=await sha256(state);
  await env.DB.prepare(`INSERT INTO bing_webmaster_oauth_states(state_hash,admin_id,expires_at) VALUES(?,?,datetime('now','+10 minutes'))`).bind(stateHash,admin.admin_id).run();
  const redirectUri=getRedirectUri(request);
  const params=new URLSearchParams({response_type:'code',client_id:clientId,redirect_uri:redirectUri,scope:'webmaster.read',state});
  return Response.redirect(`${BING_AUTHORIZE_URL}?${params}`,302);
}

async function oauthCallback(request,env,url){
  const state=String(url.searchParams.get('state')||'').trim(), code=String(url.searchParams.get('code')||'').trim(), error=String(url.searchParams.get('error')||'').trim();
  const redirectUri=getRedirectUri(request), appUrl=getAppRedirectBase(request);
  if(!state)return Response.redirect(`${appUrl}/admin/?bing=error&reason=missing_state`,302);
  const stateHash=await sha256(state), stateRow=await env.DB.prepare(`SELECT state_hash,admin_id,expires_at FROM bing_webmaster_oauth_states WHERE state_hash=? AND expires_at>CURRENT_TIMESTAMP LIMIT 1`).bind(stateHash).first();
  await env.DB.prepare('DELETE FROM bing_webmaster_oauth_states WHERE state_hash=?').bind(stateHash).run();
  if(!stateRow)return Response.redirect(`${appUrl}/admin/?bing=error&reason=invalid_state`,302);
  if(error||!code)return Response.redirect(`${appUrl}/admin/?bing=denied`,302);
  const clientId=String(env.BING_WEBMASTER_CLIENT_ID||'').trim(), clientSecret=String(env.BING_WEBMASTER_CLIENT_SECRET||'').trim();
  if(!clientId||!clientSecret)return Response.redirect(`${appUrl}/admin/?bing=error&reason=missing_credentials`,302);
  try{
    const body=new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:'authorization_code'});
    const response=await fetch(BING_TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
    const data=await response.json().catch(()=>null);
    if(!response.ok||!data?.access_token||!data?.refresh_token){console.error('Bing OAuth token exchange failed',{status:response.status,data});return Response.redirect(`${appUrl}/admin/?bing=error&reason=token_exchange`,302);}
    const accessEncrypted=await encryptToken(env.AUTH_ENCRYPTION_KEY,String(data.access_token)), refreshEncrypted=await encryptToken(env.AUTH_ENCRYPTION_KEY,String(data.refresh_token));
    const expiresIn=Math.max(Number(data.expires_in)||3600,60), accessExpiresAt=new Date(Date.now()+expiresIn*1000).toISOString();
    await env.DB.prepare(`INSERT INTO bing_webmaster_connections(admin_id,access_token_encrypted,refresh_token_encrypted,access_expires_at,scope) VALUES(?,?,?,?,?) ON CONFLICT(admin_id) DO UPDATE SET access_token_encrypted=excluded.access_token_encrypted,refresh_token_encrypted=excluded.refresh_token_encrypted,access_expires_at=excluded.access_expires_at,scope=excluded.scope,updated_at=CURRENT_TIMESTAMP`).bind(stateRow.admin_id,accessEncrypted,refreshEncrypted,accessExpiresAt,'webmaster.read').run();
    return Response.redirect(`${appUrl}/admin/?bing=connected`,302);
  }catch(err){console.error('Bing OAuth callback failed',err);return Response.redirect(`${appUrl}/admin/?bing=error&reason=callback`,302);}
}

async function connectionStatus(env,adminId){
  const row=await env.DB.prepare(`SELECT access_expires_at,scope,connected_at,updated_at FROM bing_webmaster_connections WHERE admin_id=? LIMIT 1`).bind(adminId).first();
  return json({success:true,connected:Boolean(row),accessExpiresAt:row?.access_expires_at||null,scope:row?.scope||null,connectedAt:row?.connected_at||null,updatedAt:row?.updated_at||null});
}

async function getConnection(env,adminId){
  return env.DB.prepare(`SELECT access_token_encrypted,refresh_token_encrypted,access_expires_at FROM bing_webmaster_connections WHERE admin_id=? LIMIT 1`).bind(adminId).first();
}

async function getAccessToken(env,adminId){
  const row=await getConnection(env,adminId); if(!row)return null;
  if(row.access_expires_at && Date.parse(row.access_expires_at)>Date.now()+60000)return decryptToken(env.AUTH_ENCRYPTION_KEY,row.access_token_encrypted);
  const refresh=await decryptToken(env.AUTH_ENCRYPTION_KEY,row.refresh_token_encrypted); if(!refresh)return null;
  const clientId=String(env.BING_WEBMASTER_CLIENT_ID||''), clientSecret=String(env.BING_WEBMASTER_CLIENT_SECRET||'');
  const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refresh,grant_type:'refresh_token'});
  const r=await fetch(BING_TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const data=await r.json().catch(()=>null); if(!r.ok||!data?.access_token)throw new Error(`Bing token refresh failed (${r.status})`);
  const access=String(data.access_token), encrypted=await encryptToken(env.AUTH_ENCRYPTION_KEY,access), expiresIn=Math.max(Number(data.expires_in)||3600,60), expiresAt=new Date(Date.now()+expiresIn*1000).toISOString();
  let refreshEncrypted=row.refresh_token_encrypted;
  if(data.refresh_token)refreshEncrypted=await encryptToken(env.AUTH_ENCRYPTION_KEY,String(data.refresh_token));
  await env.DB.prepare(`UPDATE bing_webmaster_connections SET access_token_encrypted=?,refresh_token_encrypted=?,access_expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE admin_id=?`).bind(encrypted,refreshEncrypted,expiresAt,adminId).run();
  return access;
}

async function bingGet(env,adminId,method,params={}){
  const token=await getAccessToken(env,adminId); if(!token)throw new Error('Bing Webmaster متصل نیست.');
  const qs=new URLSearchParams(params); const r=await fetch(`${BING_API_BASE}${method}?${qs}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
  const data=await r.json().catch(()=>null); if(!r.ok)throw new Error(data?.Message||data?.message||`Bing API error (${r.status})`);
  return Array.isArray(data?.d)?data.d:(Array.isArray(data)?data:[]);
}

async function getSites(env,adminId){
  try{return json({success:true,sites:await bingGet(env,adminId,'GetUserSites')});}
  catch(e){return json({success:false,error:e.message||'دریافت سایت‌های Bing انجام نشد.'},502);}
}

async function analyticsData(env,adminId,days){
  try{
    const sites=await bingGet(env,adminId,'GetUserSites');
    if(!sites.length)return json({success:true,siteUrl:null,traffic:[],queries:[],crawl:[],summary:{clicks:0,impressions:0,ctr:0,avgPosition:0}});
    const siteUrl=sites[0].Url||sites[0].SiteUrl||sites[0].url||sites[0].siteUrl;
    if(!siteUrl)throw new Error('Bing سایت متصل‌شده URL ندارد.');
    const [trafficRaw,queriesRaw,crawlRaw]=await Promise.all([
      bingGet(env,adminId,'GetRankAndTrafficStats',{siteUrl}),
      bingGet(env,adminId,'GetQueryStats',{siteUrl}),
      bingGet(env,adminId,'GetCrawlStats',{siteUrl})
    ]);
    const traffic=trafficRaw.map(x=>({date:parseBingDate(x.Date),clicks:Number(x.Clicks)||0,impressions:Number(x.Impressions)||0})).filter(x=>x.date).sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(-Math.max(1,Math.min(days,180)));
    const queries=queriesRaw.map(x=>({query:x.Query||'',clicks:Number(x.Clicks)||0,impressions:Number(x.Impressions)||0,position:Number(x.AvgImpressionPosition||x.AvgClickPosition)||0})).filter(x=>x.query).sort((a,b)=>b.clicks-a.clicks).slice(0,50).map(x=>({...x,ctr:x.impressions?x.clicks/x.impressions*100:0}));
    const crawl=crawlRaw.map(x=>({date:parseBingDate(x.Date),inIndex:Number(x.InIndex)||0,crawledPages:Number(x.CrawledPages)||0,crawlErrors:Number(x.CrawlErrors)||0,code4xx:Number(x.Code4xx)||0,code5xx:Number(x.Code5xx)||0})).filter(x=>x.date);
    const clicks=traffic.reduce((n,x)=>n+x.clicks,0), impressions=traffic.reduce((n,x)=>n+x.impressions,0);
    const weighted=queries.reduce((a,x)=>a+(x.position*x.impressions),0), weight=queries.reduce((a,x)=>a+x.impressions,0);
    return json({success:true,siteUrl,days,traffic,queries,crawl,summary:{clicks,impressions,ctr:impressions?clicks/impressions*100:0,avgPosition:weight?weighted/weight:0},sources:{traffic:'Bing Webmaster GetRankAndTrafficStats',queries:'Bing Webmaster GetQueryStats',crawl:'Bing Webmaster GetCrawlStats'}});
  }catch(e){console.error('Bing analytics failed',e);return json({success:false,error:e.message||'دریافت آمار Bing انجام نشد.'},502);}
}

function parseBingDate(value){
  const s=String(value||''); const m=s.match(/\\/Date\\(([-+]?\\d+)/); if(m)return new Date(Number(m[1])).toISOString();
  const d=new Date(value); return Number.isNaN(d.getTime())?null:d.toISOString();
}

async function requireAdminSession(request,env){
  const token=readCookie(request.headers.get('Cookie'),'payamake_session'); if(!token)return null;
  const tokenHash=await sha256(decodeURIComponent(token));
  return env.DB.prepare(`SELECT s.admin_id,a.full_name,a.email,a.is_active FROM admin_sessions s JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND a.is_active=1 LIMIT 1`).bind(tokenHash).first();
}
function getRedirectUri(request){const u=new URL(request.url);return `${u.origin}${REDIRECT_PATH}`;}
function getAppRedirectBase(request){return request.headers.get('Origin')==='https://staging.payamake.ir'?'https://staging.payamake.ir':'https://staging.payamake.ir';}
function readCookie(header,name){for(const item of String(header||'').split(';')){const [key,...rest]=item.trim().split('=');if(key===name)return rest.join('=');}return null;}
async function sha256(value){const data=new TextEncoder().encode(String(value));const hash=await crypto.subtle.digest('SHA-256',data);return bytesToHex(new Uint8Array(hash));}
async function deriveKey(secret){const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(secret||'')));return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function encryptToken(secret,value){if(!secret)throw new Error('AUTH_ENCRYPTION_KEY تنظیم نشده است.');const key=await deriveKey(secret),iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(value));return `${bytesToHex(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;}
async function decryptToken(secret,payload){if(!secret||!payload)return null;try{const [ivHex,cipherText]=String(payload).split('.');if(!ivHex||!cipherText)return null;const key=await deriveKey(secret),iv=new Uint8Array(ivHex.match(/.{2}/g).map(x=>parseInt(x,16))),binary=atob(cipherText),cipher=new Uint8Array([...binary].map(c=>c.charCodeAt(0)));const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,cipher);return new TextDecoder().decode(plain);}catch{return null;}}
function bytesToHex(bytes){return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');}
function bytesToBase64(bytes){let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary);}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=UTF-8','Cache-Control':'no-store'}});}
