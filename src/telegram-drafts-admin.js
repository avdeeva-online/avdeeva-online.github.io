import { publishHubResource } from './hub-resources.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=v=>String(v??'').trim();
const arr=v=>Array.isArray(v)?v:[];

async function ensureSchema(env){
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS telegram_admin_drafts(
    id TEXT PRIMARY KEY,
    source_url TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'review',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}
function parseRow(row){
  if(!row)return null;
  let analysis={};try{analysis=JSON.parse(row.payload||'{}')}catch{}
  return {id:row.id,source_url:row.source_url,status:row.status,created_at:row.created_at,updated_at:row.updated_at,analysis};
}
function summarize(row){
  const r=parseRow(row),a=r.analysis||{},d=a.draft||{};
  return {id:r.id,status:r.status,source_url:r.source_url,title:clean(d.title)||'UNTITLED RESOURCE',type:clean(d.type)||'other',creator:clean(d.creator||a.source?.channel),source_posts:Math.max(1,arr(a.sourcePosts).length),media_count:arr(a.media).length,file_count:arr(a.files).length,updated_at:r.updated_at};
}
async function telegramApi(token,method,payload={}){
  const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json().catch(()=>({ok:false,description:`HTTP_${r.status}`}));
  if(!r.ok||!d.ok)throw new Error(d.description||`TELEGRAM_${method}_FAILED`);
  return d.result;
}
async function downloadTelegramFile(token,file){
  const info=await telegramApi(token,'getFile',{file_id:file.telegram_file_id});
  if(!info?.file_path)throw new Error('TELEGRAM_FILE_PATH_MISSING');
  const r=await fetch(`https://api.telegram.org/file/bot${token}/${info.file_path}`);
  if(!r.ok)throw new Error(`TELEGRAM_FILE_DOWNLOAD_${r.status}`);
  return new File([await r.arrayBuffer()],clean(file.name)||info.file_path.split('/').pop()||'telegram-file',{type:clean(file.type)||r.headers.get('content-type')||'application/octet-stream'});
}
function applyEdits(a,b){
  a=a&&typeof a==='object'?a:{};a.source=a.source||{};a.draft=a.draft||{};
  if('title'in b)a.draft.title=clean(b.title);
  if('type'in b)a.draft.type=clean(b.type).toLowerCase();
  if('creator'in b)a.draft.creator=clean(b.creator);
  if('creatorLink'in b)a.draft.creatorLink=clean(b.creatorLink);
  if('descriptionShort'in b)a.draft.descriptionShort=clean(b.descriptionShort);
  if('descriptionFull'in b)a.draft.descriptionFull=clean(b.descriptionFull);
  if('models'in b)a.draft.models=arr(b.models).map(clean).filter(Boolean);
  if('settings'in b)a.draft.settings=arr(b.settings).map(clean).filter(Boolean);
  if('tags'in b)a.draft.tags=arr(b.tags).map(clean).filter(Boolean);
  return a;
}
async function publishDraft(env,row,edits={}){
  const token=clean(env.Node00admin);if(!token)throw new Error('ADMIN_BOT_TOKEN_MISSING');
  const a=applyEdits(parseRow(row).analysis,edits),d=a.draft||{},channel=clean(a.source?.channel);
  const files=arr(a.files),botFiles=files.filter(f=>f.telegram_file_id),remoteFiles=files.filter(f=>f.url&&!f.telegram_file_id);
  const payload={
    source:{type:'telegram',url:clean(a.source?.url)||row.source_url},
    type:clean(d.type)||'other',title:clean(d.title)||'UNTITLED RESOURCE',
    creator:{name:clean(d.creator)||channel,link:clean(d.creatorLink)||(channel?`https://t.me/${channel}`:'')},
    description_short:clean(d.descriptionShort),description_full:clean(d.descriptionFull||a.source?.rawText),additional_info:'',
    models:arr(d.models),settings:arr(d.settings),tags:arr(d.tags),media:arr(a.media).filter(x=>x?.url),confidence:a.confidence||{}
  };
  let request;
  if(botFiles.length){
    const form=new FormData();form.append('resource',new Blob([JSON.stringify(payload)],{type:'application/json'}),'resource.json');
    for(const f of botFiles)form.append('files',await downloadTelegramFile(token,f),clean(f.name)||'telegram-file');
    for(const f of remoteFiles)form.append('remoteFiles',JSON.stringify({...f,source:'telegram'}));
    request=new Request('https://internal/api/admin/hub-resource',{method:'POST',body:form});
  }else{
    payload.files=remoteFiles.map(f=>({...f,source:'telegram'}));
    request=new Request('https://internal/api/admin/hub-resource',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  }
  const response=await publishHubResource(request,env),out=await response.json();
  if(!response.ok||!out.ok)throw new Error(out.detail||out.error||'PUBLISH_FAILED');
  await env.DB.prepare("UPDATE telegram_admin_drafts SET payload=?,status='published',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(a),row.id).run();
  return out;
}

export async function telegramDraftsAdmin(request,env,id='',action=''){
  await ensureSchema(env);
  if(!id){
    if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
    const rows=(await env.DB.prepare("SELECT * FROM telegram_admin_drafts WHERE status='review' ORDER BY updated_at DESC LIMIT 200").all()).results||[];
    return json({ok:true,count:rows.length,drafts:rows.map(summarize)});
  }
  const row=await env.DB.prepare('SELECT * FROM telegram_admin_drafts WHERE id=? LIMIT 1').bind(id).first();
  if(!row)return json({ok:false,error:'DRAFT_NOT_FOUND'},404);
  if(action==='publish'){
    if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
    let body={};try{body=await request.json()}catch{}
    try{return json({ok:true,published:await publishDraft(env,row,body)})}catch(e){return json({ok:false,error:'PUBLISH_FAILED',detail:String(e?.message||e)},500)}
  }
  if(request.method==='GET')return json({ok:true,draft:parseRow(row)});
  if(request.method==='DELETE'){
    await env.DB.prepare('DELETE FROM telegram_admin_drafts WHERE id=?').bind(id).run();
    try{await env.DB.prepare('DELETE FROM telegram_admin_import_session WHERE draft_id=?').bind(id).run()}catch{}
    return json({ok:true,deleted:true});
  }
  if(request.method==='PATCH'||request.method==='POST'){
    let body={};try{body=await request.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
    const parsed=parseRow(row),analysis=applyEdits(parsed.analysis,body);
    await env.DB.prepare("UPDATE telegram_admin_drafts SET payload=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(analysis),id).run();
    const fresh=await env.DB.prepare('SELECT * FROM telegram_admin_drafts WHERE id=? LIMIT 1').bind(id).first();
    return json({ok:true,draft:parseRow(fresh)});
  }
  return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
}
