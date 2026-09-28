// CODEX profiles: admin-written description, links and hashtags for a universe or an author.
// Public:  GET /api/codex-profiles                 → {ok, profiles:[{kind,name,description,links,hashtags}]}
// Admin:   GET /api/admin/codex-profiles           → same, plus updatedAt
//          POST /api/admin/codex-profiles {action:'set'|'delete', kind, name, description, links, hashtags}
import { requireD1Schema } from './d1-schema.js';

const KINDS=['universe','author'];
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const key=v=>clean(v).toLocaleLowerCase();
const parse=v=>{try{const x=JSON.parse(v||'[]');return Array.isArray(x)?x:[]}catch{return[]}};
const json=(data,status=200,cache='no-store')=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':cache}});
const ensureSchema=env=>requireD1Schema(env,'codex-profiles','SELECT kind,name_key,name,description,links,hashtags,updated_at FROM codex_profiles LIMIT 1');

// Only http(s) links; a bare "site.com" gets https://.
function normalizeUrl(raw){
  let v=clean(raw);if(!v)return'';
  if(!/^[a-z][a-z0-9+.-]*:/i.test(v))v=`https://${v}`;
  try{const u=new URL(v);return u.protocol==='https:'||u.protocol==='http:'?u.toString():''}catch{return''}
}
function normalizeLinks(values){
  const out=[],seen=new Set();
  for(const item of Array.isArray(values)?values:[]){
    const url=normalizeUrl(item?.url);if(!url||seen.has(url))continue;seen.add(url);
    let label=clean(item?.label).slice(0,40);
    if(!label){try{label=new URL(url).hostname.replace(/^www\./,'')}catch{label='Link'}}
    out.push({label,url});if(out.length>=20)break;
  }
  return out;
}
function normalizeHashtags(values){
  const out=[],seen=new Set();
  for(const raw of Array.isArray(values)?values:String(values||'').split(/[,\n]/)){
    const v=clean(raw).replace(/^#+\s*/,'').slice(0,40),k=v.toLocaleLowerCase();
    if(!v||seen.has(k))continue;seen.add(k);out.push(v);if(out.length>=20)break;
  }
  return out;
}
const toProfile=r=>({kind:r.kind,name:r.name,description:r.description||'',links:normalizeLinks(parse(r.links)),hashtags:normalizeHashtags(parse(r.hashtags)),updatedAt:r.updated_at||null});

async function list(env){
  await ensureSchema(env);
  const res=await env.DB.prepare('SELECT kind,name_key,name,description,links,hashtags,updated_at FROM codex_profiles ORDER BY kind,name COLLATE NOCASE').all();
  return (res?.results||[]).map(toProfile);
}

async function mutate(request,env){
  await ensureSchema(env);
  let b;try{b=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
  const action=clean(b?.action),kind=clean(b?.kind),name=clean(b?.name).slice(0,120);
  if(!KINDS.includes(kind)||!name)return json({ok:false,error:'KIND_AND_NAME_REQUIRED'},400);
  if(action==='delete'){
    await env.DB.prepare('DELETE FROM codex_profiles WHERE kind=? AND name_key=?').bind(kind,key(name)).run();
    return json({ok:true,action,kind,name});
  }
  if(action!=='set')return json({ok:false,error:'UNKNOWN_ACTION'},400);
  const description=String(b?.description??'').replace(/\r/g,'').trim().slice(0,4000);
  const links=normalizeLinks(b?.links),hashtags=normalizeHashtags(b?.hashtags);
  await env.DB.prepare(`INSERT INTO codex_profiles(kind,name_key,name,description,links,hashtags,updated_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(kind,name_key) DO UPDATE SET name=excluded.name,description=excluded.description,links=excluded.links,hashtags=excluded.hashtags,updated_at=CURRENT_TIMESTAMP`)
    .bind(kind,key(name),name,description,JSON.stringify(links),JSON.stringify(hashtags)).run();
  return json({ok:true,action,profile:{kind,name,description,links,hashtags}});
}

export async function handleCodexProfilesRoute(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/api/codex-profiles'){
    if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
    // The public page must keep working even before the migration is applied.
    let profiles=[];try{profiles=(await list(env)).map(({updatedAt,...p})=>p)}catch{}
    return json({ok:true,profiles},200,'public, max-age=60');
  }
  if(path==='/api/admin/codex-profiles'){
    if(request.method==='GET')return json({ok:true,profiles:await list(env)});
    if(request.method==='POST')return mutate(request,env);
    return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  }
  return null;
}
