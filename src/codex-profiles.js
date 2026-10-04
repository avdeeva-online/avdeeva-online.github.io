// CODEX data written in the admin.
// Profiles (universe / author): description, links, hashtags, avatar.
//   GET  /api/codex-profiles            → {ok, profiles:[{kind,name,description,links,hashtags,avatar_url}]}
//   GET  /api/admin/codex-profiles      → same, plus updatedAt
//   POST /api/admin/codex-profiles      {action:'set'|'delete', kind, name, description, links, hashtags, avatar?}
//        avatar: a data:image URL to replace it, '' to remove it, omitted to keep it.
// Styles (image-generation prompts — NovelAI v4.5 / v5, Nano Banana…): picture + prompt copied on the site.
//   GET  /api/codex-styles              → {ok, styles:[{id,title,prompt,model,author,author_link,image_url}]}
//   GET  /api/admin/codex-styles        → same
//   POST /api/admin/codex-styles        {action:'set', id?, title, prompt, model, author, author_link, image?} | {action:'delete', id} | {action:'move', id, dir:-1|1}
// Pictures live in R2 (HUB_FILES) under codex/…:  GET /api/codex-image?key=codex/…&v=…
import { requireD1Schema } from './d1-schema.js';

const KINDS=['universe','author'];
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const key=v=>clean(v).toLocaleLowerCase();
const parse=v=>{try{const x=JSON.parse(v||'[]');return Array.isArray(x)?x:[]}catch{return[]}};
const json=(data,status=200,cache='no-store')=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':cache}});
const ensureProfiles=env=>requireD1Schema(env,'codex-profiles','SELECT kind,name_key,name,description,links,hashtags,avatar_key,updated_at FROM codex_profiles LIMIT 1');
const ensureStyles=env=>requireD1Schema(env,'codex-styles','SELECT id,title,prompt,model,author,author_link,image_key,image_type,sort FROM codex_styles LIMIT 1');

// ---- shared helpers ----
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
const hasR2=env=>Boolean(env?.HUB_FILES&&typeof env.HUB_FILES.put==='function');
const IMAGE_LIMIT=700*1024;
// data:image/…;base64,… → bytes (webp / png / jpeg / gif only, ≤ 700 KB; the admin page compresses before sending).
function decodeImage(dataUrl){
  const m=String(dataUrl||'').match(/^data:(image\/(?:webp|png|jpeg|gif));base64,([a-z0-9+/=\s]+)$/i);
  if(!m)throw new Error('IMAGE_FORMAT');
  const bin=atob(m[2].replace(/\s+/g,''));if(!bin.length||bin.length>IMAGE_LIMIT)throw new Error('IMAGE_SIZE');
  return{type:m[1].toLowerCase(),bytes:Uint8Array.from(bin,c=>c.charCodeAt(0))};
}
async function shortHash(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].slice(0,8).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function putImage(env,objectKey,img){if(!hasR2(env))throw new Error('R2_BINDING_REQUIRED');await env.HUB_FILES.put(objectKey,img.bytes,{httpMetadata:{contentType:img.type}})}
async function dropImage(env,objectKey){if(objectKey&&hasR2(env)&&typeof env.HUB_FILES.delete==='function'){try{await env.HUB_FILES.delete(objectKey)}catch(e){console.error('codex image delete failed',objectKey,e)}}}
const imageUrl=(objectKey,version)=>objectKey?`/api/codex-image?${new URLSearchParams({key:objectKey,v:String(version||'').replace(/\D/g,'').slice(-12)})}`:'';

async function serveImage(request,env){
  const objectKey=new URL(request.url).searchParams.get('key')||'';
  if(!/^codex\/[a-z0-9/_-]+$/i.test(objectKey))return json({ok:false,error:'BAD_KEY'},400);
  if(!hasR2(env))return json({ok:false,error:'R2_BINDING_REQUIRED'},503);
  const obj=await env.HUB_FILES.get(objectKey);if(!obj)return json({ok:false,error:'NOT_FOUND'},404);
  const headers=new Headers({'content-type':obj.httpMetadata?.contentType||'image/webp','cache-control':'public, max-age=604800','x-content-type-options':'nosniff'});
  if(obj.httpEtag)headers.set('etag',obj.httpEtag);
  return new Response(obj.body,{status:200,headers});
}

// ---- profiles ----
const toProfile=r=>({kind:r.kind,name:r.name,description:r.description||'',links:normalizeLinks(parse(r.links)),hashtags:normalizeHashtags(parse(r.hashtags)),avatar_url:imageUrl(r.avatar_key,r.updated_at),updatedAt:r.updated_at||null});
async function listProfiles(env){
  await ensureProfiles(env);
  const res=await env.DB.prepare('SELECT kind,name_key,name,description,links,hashtags,avatar_key,updated_at FROM codex_profiles ORDER BY kind,name COLLATE NOCASE').all();
  return (res?.results||[]).map(toProfile);
}
async function mutateProfile(request,env){
  await ensureProfiles(env);
  let b;try{b=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
  const action=clean(b?.action),kind=clean(b?.kind),name=clean(b?.name).slice(0,120);
  if(!KINDS.includes(kind)||!name)return json({ok:false,error:'KIND_AND_NAME_REQUIRED'},400);
  const current=await env.DB.prepare('SELECT avatar_key FROM codex_profiles WHERE kind=? AND name_key=?').bind(kind,key(name)).first();
  if(action==='delete'){
    await env.DB.prepare('DELETE FROM codex_profiles WHERE kind=? AND name_key=?').bind(kind,key(name)).run();
    await dropImage(env,current?.avatar_key);
    return json({ok:true,action,kind,name});
  }
  if(action!=='set')return json({ok:false,error:'UNKNOWN_ACTION'},400);
  const description=String(b?.description??'').replace(/\r/g,'').trim().slice(0,4000);
  const links=normalizeLinks(b?.links),hashtags=normalizeHashtags(b?.hashtags);
  let avatarKey=current?.avatar_key||'';
  if(typeof b?.avatar==='string'){
    if(b.avatar){let img;try{img=decodeImage(b.avatar)}catch(e){return json({ok:false,error:e.message},400)}
      const next=`codex/avatars/${kind}/${await shortHash(key(name))}-${(await shortHash(b.avatar)).slice(0,8)}`;
      try{await putImage(env,next,img)}catch(e){return json({ok:false,error:e.message},503)}
      if(avatarKey&&avatarKey!==next)await dropImage(env,avatarKey);avatarKey=next}
    else{await dropImage(env,avatarKey);avatarKey=''}
  }
  await env.DB.prepare(`INSERT INTO codex_profiles(kind,name_key,name,description,links,hashtags,avatar_key,updated_at) VALUES(?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(kind,name_key) DO UPDATE SET name=excluded.name,description=excluded.description,links=excluded.links,hashtags=excluded.hashtags,avatar_key=excluded.avatar_key,updated_at=CURRENT_TIMESTAMP`)
    .bind(kind,key(name),name,description,JSON.stringify(links),JSON.stringify(hashtags),avatarKey).run();
  return json({ok:true,action,profile:{kind,name,description,links,hashtags,avatar_url:imageUrl(avatarKey,Date.now())}});
}

// ---- styles ----
const toStyle=r=>({id:r.id,title:r.title||'',prompt:r.prompt||'',model:r.model||'',author:r.author||'',author_link:r.author_link||'',image_url:imageUrl(r.image_key,r.updated_at),sort:Number(r.sort||0)});
async function listStyles(env){
  await ensureStyles(env);
  const res=await env.DB.prepare('SELECT id,title,prompt,model,author,author_link,image_key,sort,updated_at FROM codex_styles ORDER BY sort,created_at').all();
  return (res?.results||[]).map(toStyle);
}
async function mutateStyle(request,env){
  await ensureStyles(env);
  let b;try{b=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
  const action=clean(b?.action),id=clean(b?.id).replace(/[^a-z0-9-]/gi,'').slice(0,40);
  const current=id?await env.DB.prepare('SELECT id,image_key,sort FROM codex_styles WHERE id=?').bind(id).first():null;
  if(action==='delete'){
    if(!current)return json({ok:false,error:'STYLE_NOT_FOUND'},404);
    await env.DB.prepare('DELETE FROM codex_styles WHERE id=?').bind(id).run();
    await dropImage(env,current.image_key);
    return json({ok:true,action,id});
  }
  if(action==='move'){
    if(!current)return json({ok:false,error:'STYLE_NOT_FOUND'},404);
    const all=(await env.DB.prepare('SELECT id FROM codex_styles ORDER BY sort,created_at').all()).results||[];
    const i=all.findIndex(x=>x.id===id),j=i+(Number(b?.dir)<0?-1:1);
    if(j>=0&&j<all.length){[all[i],all[j]]=[all[j],all[i]];await env.DB.batch(all.map((x,n)=>env.DB.prepare('UPDATE codex_styles SET sort=? WHERE id=?').bind(n,x.id)))}
    return json({ok:true,action,id});
  }
  if(action!=='set')return json({ok:false,error:'UNKNOWN_ACTION'},400);
  const title=clean(b?.title).slice(0,120),prompt=String(b?.prompt??'').replace(/\r/g,'').trim().slice(0,6000);
  if(!title||!prompt)return json({ok:false,error:'TITLE_AND_PROMPT_REQUIRED'},400);
  const model=clean(b?.model).slice(0,60),author=clean(b?.author).replace(/^@+/,'').slice(0,80),authorLink=normalizeUrl(b?.author_link);
  const styleId=current?.id||crypto.randomUUID().replace(/-/g,'').slice(0,12);
  let imageKey=current?.image_key||'',imageType='';
  if(typeof b?.image==='string'&&b.image){
    let img;try{img=decodeImage(b.image)}catch(e){return json({ok:false,error:e.message},400)}
    const next=`codex/styles/${styleId}-${(await shortHash(b.image)).slice(0,8)}`;
    try{await putImage(env,next,img)}catch(e){return json({ok:false,error:e.message},503)}
    if(imageKey&&imageKey!==next)await dropImage(env,imageKey);imageKey=next;imageType=img.type;
  }else if(b?.image===''&&imageKey){await dropImage(env,imageKey);imageKey=''}
  if(current){
    await env.DB.prepare('UPDATE codex_styles SET title=?,prompt=?,model=?,author=?,author_link=?,image_key=?,image_type=CASE WHEN ?<>\'\' THEN ? ELSE image_type END,updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .bind(title,prompt,model,author,authorLink,imageKey,imageType,imageType,styleId).run();
  }else{
    const last=await env.DB.prepare('SELECT COALESCE(MAX(sort),-1)+1 AS n FROM codex_styles').first();
    await env.DB.prepare('INSERT INTO codex_styles(id,title,prompt,model,author,author_link,image_key,image_type,sort) VALUES(?,?,?,?,?,?,?,?,?)')
      .bind(styleId,title,prompt,model,author,authorLink,imageKey,imageType,Number(last?.n||0)).run();
  }
  return json({ok:true,action,id:styleId});
}

export async function handleCodexProfilesRoute(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/api/codex-image'){if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return serveImage(request,env)}
  if(path==='/api/codex-profiles'){
    if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
    // The public page must keep working even before the migration is applied.
    let profiles=[];try{profiles=(await listProfiles(env)).map(({updatedAt,...p})=>p)}catch{}
    return json({ok:true,profiles},200,'public, max-age=60');
  }
  if(path==='/api/codex-styles'){
    if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
    let styles=[];try{styles=(await listStyles(env)).map(({sort,...s})=>s)}catch{}
    return json({ok:true,styles},200,'public, max-age=60');
  }
  if(path==='/api/admin/codex-profiles'){
    if(request.method==='GET')return json({ok:true,profiles:await listProfiles(env)});
    if(request.method==='POST')return mutateProfile(request,env);
    return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  }
  if(path==='/api/admin/codex-styles'){
    if(request.method==='GET')return json({ok:true,styles:await listStyles(env)});
    if(request.method==='POST')return mutateStyle(request,env);
    return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  }
  return null;
}
