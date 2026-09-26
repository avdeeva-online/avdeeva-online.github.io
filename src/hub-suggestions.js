const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

let schemaReady=null;
async function ensureTable(env){
  if(schemaReady)return schemaReady;
  schemaReady=env.DB.prepare('SELECT id FROM hub_suggestions LIMIT 1').first().then(()=>true).catch(e=>{schemaReady=null;throw new Error(`D1_MIGRATION_REQUIRED: hub_suggestions: ${String(e?.message||e)}`)});
  return schemaReady;
}

// Spam guard for the public form: per-visitor and site-wide hourly caps. Only a salted IP hash is kept.
const PER_CLIENT_PER_HOUR=5,GLOBAL_PER_HOUR=60;
async function clientHash(request){const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')||'unknown';const bytes=new TextEncoder().encode(`archive-hub-suggest|${ip}`),hash=await crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(hash)].slice(0,12).map(x=>x.toString(16).padStart(2,'0')).join('')}

function normalizeUrl(raw){
  try{
    const u=new URL(String(raw||'').trim());
    if(!/^https?:$/.test(u.protocol))return '';
    u.hash='';
    return u.toString().slice(0,1800);
  }catch{return ''}
}

export async function submitHubSuggestion(request,env){
  if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const len=Number(request.headers.get('content-length')||0);
  if(len>12000)return json({ok:false,error:'PAYLOAD_TOO_LARGE'},413);
  let body={};
  try{body=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
  if(body.website)return json({ok:true}); // honeypot
  const url=normalizeUrl(body.url);
  const note=String(body.note||'').trim().slice(0,1200);
  if(!url)return json({ok:false,error:'VALID_URL_REQUIRED'},400);
  await ensureTable(env);
  const recent=await env.DB.prepare("SELECT id FROM hub_suggestions WHERE url=? AND status IN ('new','reviewing') AND created_at >= datetime('now','-30 days') LIMIT 1").bind(url).first();
  if(recent)return json({ok:true,duplicate:true});
  const client=await clientHash(request);
  const limits=await env.DB.prepare("SELECT (SELECT COUNT(*) FROM hub_suggestions WHERE client_hash=? AND created_at >= datetime('now','-1 hour')) AS mine,(SELECT COUNT(*) FROM hub_suggestions WHERE created_at >= datetime('now','-1 hour')) AS total").bind(client).first();
  if(Number(limits?.mine||0)>=PER_CLIENT_PER_HOUR||Number(limits?.total||0)>=GLOBAL_PER_HOUR)return json({ok:false,error:'TOO MANY SUGGESTIONS — TRY AGAIN LATER'},429);
  const out=await env.DB.prepare("INSERT INTO hub_suggestions(url,note,status,client_hash,created_at,updated_at) VALUES(?,?,'new',?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").bind(url,note,client).run();
  return json({ok:true,id:out.meta?.last_row_id||null},201);
}

export async function listHubSuggestions(request,env){
  if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  await ensureTable(env);
  const url=new URL(request.url),status=String(url.searchParams.get('status')||'').trim();
  let q='SELECT id,url,note,status,created_at,updated_at FROM hub_suggestions';
  const args=[];
  if(status&&status!=='all'){q+=' WHERE status=?';args.push(status)}
  q+=' ORDER BY CASE status WHEN \'new\' THEN 0 WHEN \'reviewing\' THEN 1 ELSE 2 END, created_at DESC LIMIT 500';
  const rows=(await env.DB.prepare(q).bind(...args).all()).results||[];
  return json({ok:true,suggestions:rows});
}

export async function updateHubSuggestion(request,env,id){
  await ensureTable(env);
  if(request.method==='DELETE'){
    await env.DB.prepare('DELETE FROM hub_suggestions WHERE id=?').bind(Number(id)).run();
    return json({ok:true});
  }
  if(request.method!=='PATCH'&&request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  let body={};try{body=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
  const allowed=new Set(['new','reviewing','added','ignored']);
  const status=String(body.status||'').trim();
  if(!allowed.has(status))return json({ok:false,error:'INVALID_STATUS'},400);
  await env.DB.prepare('UPDATE hub_suggestions SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status,Number(id)).run();
  return json({ok:true});
}
