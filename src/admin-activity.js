// Admin activity log + "what changed in the last 24 h".
// Every write to /api/admin/* (POST / PATCH / PUT / DELETE) is recorded after the response: who (Cloudflare Access
// email), from where (country, IP), what (path + a short, secret-free summary of the request) and the HTTP status.
// Refused requests are recorded too — a 401/403 here means someone without access tried.
//   GET /api/admin/activity?hours=24 → {ok, log:[…], changes:{characters,hub,styles,profiles,universes}, actors:[…]}
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
// Only these request fields go into the log; keys, tokens, passwords and picture data never do.
const SAFE_FIELDS=['action','kind','name','id','uuid','title','status','source','url','editing_id','tab','dir','confirm','model','author'];
const SECRET=/key|token|secret|pass|auth|cookie|session/i;

export function isLoggedAdminWrite(request,url){return url.pathname.startsWith('/api/admin/')&&!['GET','HEAD','OPTIONS'].includes(request.method)&&url.pathname!=='/api/admin/activity'}

async function summarize(request){
  const type=String(request.headers.get('content-type')||'').toLowerCase();
  if(type.includes('multipart/form-data'))return'upload (files)';
  if(!type.includes('json'))return'';
  let body;try{body=await request.json()}catch{return''}
  if(!body||typeof body!=='object')return'';
  const parts=[];
  for(const k of SAFE_FIELDS){
    if(!(k in body)||SECRET.test(k))continue;
    let v=body[k];
    if(v&&typeof v==='object')v=v.url||v.name||'';
    v=clean(v);if(!v||/^data:/i.test(v))continue;
    parts.push(`${k}=${v.slice(0,80)}`);
  }
  if(Array.isArray(body.images))parts.push(`images=${body.images.length}`);
  if(Array.isArray(body.extra_links))parts.push(`extra_links=${body.extra_links.length}`);
  return parts.join(' · ').slice(0,300);
}

export async function logAdminWrite(env,request,response,url){
  try{
    if(!env?.DB)return;
    const actor=clean(request.headers.get('cf-access-authenticated-user-email'))||'(no Access login)';
    const ip=clean(request.headers.get('cf-connecting-ip')),country=clean(request.cf?.country||request.headers.get('cf-ipcountry'));
    await env.DB.prepare('INSERT INTO admin_audit_log(actor,ip,country,method,path,status,detail) VALUES(?,?,?,?,?,?,?)')
      .bind(actor.slice(0,120),ip.slice(0,64),country.slice(0,8),request.method,url.pathname.slice(0,200),Number(response?.status||0),await summarize(request)).run();
    // Keep 90 days; prune now and then.
    if(Math.random()<.02)await env.DB.prepare("DELETE FROM admin_audit_log WHERE at < datetime('now','-90 days')").run();
  }catch(e){console.error('admin audit log failed',e)}
}

const since=hours=>`-${Math.max(1,Math.min(24*30,Number(hours)||24))} hours`;
async function rows(env,sql,...args){try{return (await env.DB.prepare(sql).bind(...args).all()).results||[]}catch{return null}}

export async function adminActivity(request,env){
  if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const hours=Math.max(1,Math.min(24*30,Number(new URL(request.url).searchParams.get('hours'))||24)),window=since(hours);
  const log=await rows(env,"SELECT id,at,actor,ip,country,method,path,status,detail FROM admin_audit_log WHERE at >= datetime('now',?) ORDER BY id DESC LIMIT 300",window);
  const actors=await rows(env,"SELECT actor,COUNT(*) AS n,MAX(at) AS last,GROUP_CONCAT(DISTINCT country) AS countries FROM admin_audit_log WHERE at >= datetime('now',?) GROUP BY actor ORDER BY n DESC",window);
  // What changed in the data itself (also catches changes made outside the admin, e.g. imports and the Telegram bot).
  const changes={
    characters:await rows(env,"SELECT name,author,status,updated_at FROM characters WHERE updated_at >= datetime('now',?) ORDER BY updated_at DESC LIMIT 50",window),
    charactersCount:(await rows(env,"SELECT COUNT(*) AS n FROM characters WHERE updated_at >= datetime('now',?)",window))?.[0]?.n??null,
    charactersNew:(await rows(env,"SELECT COUNT(*) AS n FROM characters WHERE created_at >= datetime('now',?)",window))?.[0]?.n??null,
    hub:await rows(env,"SELECT title,type,status,updated_at FROM hub_resources WHERE updated_at >= datetime('now',?) ORDER BY updated_at DESC LIMIT 50",window),
    styles:await rows(env,"SELECT title,model,updated_at FROM codex_styles WHERE updated_at >= datetime('now',?) ORDER BY updated_at DESC LIMIT 50",window),
    profiles:await rows(env,"SELECT kind,name,updated_at FROM codex_profiles WHERE updated_at >= datetime('now',?) ORDER BY updated_at DESC LIMIT 50",window),
    universes:await rows(env,"SELECT source_value,public_universes,active,updated_at FROM universe_curation WHERE updated_at >= datetime('now',?) ORDER BY updated_at DESC LIMIT 50",window)
  };
  return json({ok:true,hours,logReady:log!==null,log:log||[],actors:actors||[],changes,now:new Date().toISOString()});
}
