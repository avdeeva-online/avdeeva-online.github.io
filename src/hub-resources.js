import { requireD1Schema } from './d1-schema.js';
import { analyzeTelegramPost } from './hub-telegram.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=v=>String(v??'').trim();
const normalizeSourceUrl=v=>{
  const raw=clean(v);if(!raw)return'';
  try{
    const u=new URL(raw);
    u.hash='';
    u.hostname=u.hostname.toLowerCase();
    if((u.protocol==='https:'&&u.port==='443')||(u.protocol==='http:'&&u.port==='80'))u.port='';
    u.pathname=u.pathname.replace(/\/+$/,'')||'/';
    const params=[...u.searchParams.entries()].sort((a,b)=>a[0].localeCompare(b[0])||a[1].localeCompare(b[1]));
    u.search='';for(const [k,val] of params)u.searchParams.append(k,val);
    return u.toString().replace(/\/$/,'');
  }catch{return raw.replace(/\/+$/,'')}
};
const arr=v=>Array.isArray(v)?v:[];
const safeJson=v=>{try{return JSON.stringify(v??[])}catch{return'[]'}};
const parseJson=(v,fallback=[])=>{try{const x=JSON.parse(v||'');return x??fallback}catch{return fallback}};
const ALLOWED_SETTINGS=new Set(['modern','fantasy','medieval','post-apocalypse','sci-fi','omegaverse','rusreal']);
const EXTRA_PREFIX='__extra__';
const SOURCE_PREFIX='__extra__source__';
const CHUNK_SIZE=768*1024;
const NORMAL_TOTAL_LIMIT=25*1024*1024;
const NORMAL_FILE_LIMIT=10*1024*1024;
const EXTRA_TOTAL_LIMIT=12*1024*1024;
const EXTRA_FILE_LIMIT=4*1024*1024;
const normalizeSettings=v=>[...new Set(arr(v).map(x=>{x=clean(x).toLowerCase();if(x==='historical')return'medieval';if(x==='magic')return'fantasy';return x}).filter(x=>ALLOWED_SETTINGS.has(x)))];
const isExtraMeta=name=>clean(name).startsWith(EXTRA_PREFIX);
const isSourceMeta=name=>clean(name).startsWith(SOURCE_PREFIX);
const inferMime=(name,mime='')=>{const m=clean(mime).toLowerCase();if(m&&m!=='application/octet-stream')return m;const n=clean(name).toLowerCase();if(/\.webp$/.test(n))return'image/webp';if(/\.png$/.test(n))return'image/png';if(/\.jpe?g$/.test(n))return'image/jpeg';if(/\.gif$/.test(n))return'image/gif';if(/\.json$/.test(n))return'application/json';if(/\.zip$/.test(n))return'application/zip';if(/\.txt$/.test(n))return'text/plain';if(/\.css$/.test(n))return'text/css';return m||'application/octet-stream'};
const toBytes=v=>{if(v instanceof Uint8Array)return v;if(v instanceof ArrayBuffer)return new Uint8Array(v);if(ArrayBuffer.isView(v))return new Uint8Array(v.buffer,v.byteOffset,v.byteLength);if(Array.isArray(v))return Uint8Array.from(v);return new Uint8Array(0)};
const hasR2=env=>Boolean(env?.HUB_FILES&&typeof env.HUB_FILES.put==='function'&&typeof env.HUB_FILES.get==='function');
const safeKeyName=name=>clean(name).replace(/[^a-z0-9._-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,120)||'file';
const r2Key=(resourceId,fileId,name)=>`hub/${resourceId}/${fileId}/${safeKeyName(name)}`;
const ensureSchema=env=>requireD1Schema(env,'hub-resources',`SELECT
  (SELECT COUNT(*) FROM hub_resources WHERE additional_info IS NOT NULL OR 1=1) AS resources,
  (SELECT COUNT(*) FROM hub_resource_files WHERE storage IS NOT NULL OR r2_key IS NOT NULL OR 1=1) AS files,
  (SELECT COUNT(*) FROM hub_resource_file_chunks) AS chunks,
  (SELECT COUNT(*) FROM hub_resource_publish_sessions) AS sessions,
  (SELECT COUNT(*) FROM hub_resource_publish_files) AS session_files`);

// Session state stores the already-normalized draft; re-reading it must not run the raw-payload mapping again
// (that dropped source URL, creator and descriptions on finalize).
function normalizeDraft(d){if(d&&typeof d==='object'&&'sourceUrl'in d)return{...d,editingId:clean(d.editingId),sourceUrl:normalizeSourceUrl(d.sourceUrl),sourceType:clean(d.sourceType)||'telegram',models:arr(d.models),settings:normalizeSettings(d.settings),tags:arr(d.tags),media:arr(d.media),confidence:d.confidence&&typeof d.confidence==='object'?d.confidence:{}};const source=d?.source||{};return{editingId:clean(d?.editing_id),sourceUrl:normalizeSourceUrl(source.url),sourceType:clean(source.type)||'telegram',type:clean(d?.type).toLowerCase(),title:clean(d?.title),creatorName:clean(d?.creator?.name),creatorLink:clean(d?.creator?.link),short:clean(d?.description_short),full:clean(d?.description_full),additionalInfo:clean(d?.additional_info),models:arr(d?.models).map(clean).filter(Boolean),settings:normalizeSettings(d?.settings),tags:arr(d?.tags).map(clean).filter(Boolean),media:arr(d?.media),confidence:d?.confidence&&typeof d.confidence==='object'?d.confidence:{}}}
function parseSessionState(session){let raw=null;try{raw=JSON.parse(session?.backup||'null')}catch{}if(raw&&raw.version===2&&raw.draft)return{version:2,old:raw.old||null,draft:normalizeDraft(raw.draft),oldPrimaryId:clean(raw.oldPrimaryId),phase:clean(raw.phase)||'editing'};return{version:1,old:raw&&typeof raw==='object'?raw:null,draft:null,oldPrimaryId:'',phase:'legacy'}}
async function saveSessionState(env,session,state){await env.DB.prepare('UPDATE hub_resource_publish_sessions SET backup=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(JSON.stringify({version:2,old:state.old||null,draft:state.draft,oldPrimaryId:clean(state.oldPrimaryId),phase:clean(state.phase)||'editing'}),session.id).run()}

async function parsePublishRequest(request){
  const ct=request.headers.get('content-type')||'';
  if(ct.includes('multipart/form-data')){
    const form=await request.formData(),resourcePart=form.get('resource');
    let raw='{}';
    if(resourcePart instanceof File||resourcePart instanceof Blob)raw=await resourcePart.text();else if(resourcePart!=null)raw=String(resourcePart);
    let draft={};try{draft=JSON.parse(raw||'{}')}catch{throw new Error('INVALID_RESOURCE_JSON')}
    const files=[],extraImages=[],remoteFiles=[];
    for(const [key,value] of form.entries()){
      if(key==='files'&&value instanceof File)files.push(value);
      if(key==='extraImages'&&value instanceof File)extraImages.push(value);
      if(key==='remoteFiles'&&typeof value==='string'){try{const x=JSON.parse(value);if(x?.url)remoteFiles.push(x)}catch{}}
    }
    return{draft,files,extraImages,remoteFiles};
  }
  let draft;try{draft=await request.json()}catch{throw new Error('INVALID_JSON')}
  return{draft,files:[],extraImages:[],remoteFiles:arr(draft?.files).filter(x=>x?.source==='telegram'&&x?.url)};
}

async function readD1Body(env,row){
  if(row?.data!=null){const body=toBytes(row.data);if(!body.byteLength&&Number(row.size||0)>0)throw new Error('FILE_DATA_INVALID');return body}
  const chunks=await env.DB.prepare('SELECT data FROM hub_resource_file_chunks WHERE file_id=? ORDER BY chunk_index ASC').bind(row.id).all();
  if(!(chunks.results||[]).length){if(Number(row.size||0)===0)return new Uint8Array(0);throw new Error('FILE_DATA_MISSING')}
  const parts=(chunks.results||[]).map(x=>toBytes(x.data)),total=parts.reduce((n,p)=>n+p.byteLength,0),joined=new Uint8Array(total);
  let offset=0;for(const p of parts){joined.set(p,offset);offset+=p.byteLength}
  return joined;
}

async function deleteStoredFile(env,fileId,resourceId=''){
  const row=resourceId
    ?await env.DB.prepare('SELECT id,storage,r2_key FROM hub_resource_files WHERE id=? AND resource_id=? LIMIT 1').bind(fileId,resourceId).first()
    :await env.DB.prepare('SELECT id,storage,r2_key FROM hub_resource_files WHERE id=? LIMIT 1').bind(fileId).first();
  if(!row)return;
  if(clean(row.storage)==='r2'&&clean(row.r2_key)){
    if(!hasR2(env))throw new Error('R2_BINDING_REQUIRED');
    await env.HUB_FILES.delete(clean(row.r2_key));
  }
  await env.DB.prepare('DELETE FROM hub_resource_file_chunks WHERE file_id=?').bind(fileId).run();
  if(resourceId)await env.DB.prepare('DELETE FROM hub_resource_files WHERE id=? AND resource_id=?').bind(fileId,resourceId).run();
  else await env.DB.prepare('DELETE FROM hub_resource_files WHERE id=?').bind(fileId).run();
}

async function retireStoredFile(env,fileId,resourceId='',reason='lifecycle'){
  const row=resourceId
    ?await env.DB.prepare('SELECT id,storage,r2_key FROM hub_resource_files WHERE id=? AND resource_id=? LIMIT 1').bind(fileId,resourceId).first()
    :await env.DB.prepare('SELECT id,storage,r2_key FROM hub_resource_files WHERE id=? LIMIT 1').bind(fileId).first();
  if(!row)return{retired:false,orphan:false};
  const removeRow=resourceId
    ?env.DB.prepare('DELETE FROM hub_resource_files WHERE id=? AND resource_id=?').bind(fileId,resourceId)
    :env.DB.prepare('DELETE FROM hub_resource_files WHERE id=?').bind(fileId);
  await env.DB.batch([removeRow,env.DB.prepare('DELETE FROM hub_resource_file_chunks WHERE file_id=?').bind(fileId)]);
  let orphan=false;
  if(clean(row.storage)==='r2'&&clean(row.r2_key)){
    if(!hasR2(env)){orphan=true;console.error('retired R2 file left orphaned',reason,fileId,row.r2_key,'R2_BINDING_REQUIRED')}
    else try{await env.HUB_FILES.delete(clean(row.r2_key))}catch(e){orphan=true;console.error('retired R2 file cleanup failed',reason,fileId,row.r2_key,e)}
  }
  return{retired:true,orphan};
}

async function storeBuffer(env,{resourceId,name,mime,size,isPrimary,buffer}){
  const fileId=crypto.randomUUID(),resolvedMime=inferMime(name,mime),actualSize=Number(size)||Number(buffer?.byteLength)||0;
  if(hasR2(env)){
    const key=r2Key(resourceId,fileId,name);
    await env.HUB_FILES.put(key,buffer,{httpMetadata:{contentType:resolvedMime},customMetadata:{resourceId,fileId,name}});
    try{
      await env.DB.prepare(`INSERT INTO hub_resource_files(id,resource_id,name,mime,size,is_primary,data,external_url,storage,r2_key) VALUES(?,?,?,?,?,?,NULL,'','r2',?)`).bind(fileId,resourceId,name,resolvedMime,actualSize,isPrimary?1:0,key).run();
      return fileId;
    }catch(e){try{await env.HUB_FILES.delete(key)}catch{}throw e}
  }
  try{
    if(buffer.byteLength<=CHUNK_SIZE){
      await env.DB.prepare(`INSERT INTO hub_resource_files(id,resource_id,name,mime,size,is_primary,data,external_url,storage,r2_key) VALUES(?,?,?,?,?,?,?,'','d1','')`).bind(fileId,resourceId,name,resolvedMime,actualSize,isPrimary?1:0,buffer).run();
      return fileId;
    }
    await env.DB.prepare(`INSERT INTO hub_resource_files(id,resource_id,name,mime,size,is_primary,data,external_url,storage,r2_key) VALUES(?,?,?,?,?,?,NULL,'','d1','')`).bind(fileId,resourceId,name,resolvedMime,actualSize,isPrimary?1:0).run();
    const bytes=new Uint8Array(buffer);
    for(let offset=0,index=0;offset<bytes.length;offset+=CHUNK_SIZE,index++){
      const chunk=bytes.slice(offset,Math.min(offset+CHUNK_SIZE,bytes.length));
      await env.DB.prepare('INSERT INTO hub_resource_file_chunks(file_id,chunk_index,data) VALUES(?,?,?)').bind(fileId,index,chunk.buffer).run();
    }
    return fileId;
  }catch(e){await retireStoredFile(env,fileId,resourceId,'store-buffer-rollback');throw e}
}

// Resource media is stored as files (R2) on publish so every image has a stable URL:
// - Telegram CDN links (cdn*.telesco.pe) expire;
// - manual covers arrive as base64 data: URIs, which bloat the D1 row;
// - the editor reloads embedded images as /api/hub-resources/{id}/media/{n}, which must resolve to the old bytes.
const TELEGRAM_MEDIA_HOST=/(^|\.)(telesco\.pe|telegram-cdn\.org)$/i;
const MEDIA_EXT={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif'};
const DATA_IMAGE=/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i;
const mediaItemUrl=m=>clean(m?.url||m?.src);
function isTelegramMediaUrl(raw){try{const u=new URL(clean(raw));return u.protocol==='https:'&&TELEGRAM_MEDIA_HOST.test(u.hostname)}catch{return false}}
const isDataImage=raw=>DATA_IMAGE.test(clean(raw));
function embeddedIndex(raw,resourceId){const m=clean(raw).match(/\/api\/hub-resources\/([^/?#]+)\/media\/(\d+)(?:[?#]|$)/);return m&&decodeURIComponent(m[1])===resourceId?Number(m[2]):-1}
const needsStoring=(url,resourceId)=>isTelegramMediaUrl(url)||isDataImage(url)||embeddedIndex(url,resourceId)>=0;
async function mediaBytes(url,resourceId,oldMedia){
  const idx=embeddedIndex(url,resourceId);if(idx>=0)url=mediaItemUrl(arr(oldMedia)[idx]);
  const data=clean(url).match(DATA_IMAGE);
  if(data){const binary=atob(data[2].replace(/\s+/g,''));return{type:data[1].toLowerCase(),buffer:Uint8Array.from(binary,c=>c.charCodeAt(0)).buffer,origin:'embedded'}}
  if(!isTelegramMediaUrl(url))throw new Error(idx>=0?'EMBEDDED_SOURCE_MISSING':'UNSUPPORTED_MEDIA_URL');
  const r=await fetch(url,{redirect:'follow'}),type=clean(r.headers.get('content-type')).split(';')[0].toLowerCase();
  if(!r.ok||!type.startsWith('image/'))throw new Error(`HTTP_${r.status}_${type||'NO_TYPE'}`);
  return{type,buffer:await r.arrayBuffer(),origin:'telegram'};
}
async function storeResourceMedia(env,resourceId,media,oldMedia=[]){
  const out=[];
  for(const item of arr(media)){
    const url=mediaItemUrl(item);if(!needsStoring(url,resourceId)){out.push(item);continue}
    try{
      const {type,buffer,origin}=await mediaBytes(url,resourceId,oldMedia);
      if(!buffer.byteLength||buffer.byteLength>EXTRA_FILE_LIMIT)throw new Error(`BAD_SIZE_${buffer.byteLength}`);
      const name=`${SOURCE_PREFIX}${item?.cover?'cover__':''}${origin}_${crypto.randomUUID().slice(0,8)}${MEDIA_EXT[type]||'.jpg'}`;
      const fileId=await storeBuffer(env,{resourceId,name,mime:type,size:buffer.byteLength,isPrimary:false,buffer});
      const stored=`/api/hub-resources/${encodeURIComponent(resourceId)}/files/${encodeURIComponent(fileId)}?view=1`;
      out.push({...item,url:stored,...(item?.src!=null?{src:stored}:{}),file_id:fileId,source:`${origin}-r2`});
    }catch(e){console.error('hub media store failed',url.slice(0,80),String(e?.message||e));out.push(item)}
  }
  return out;
}

// One-off repair for resources published before media storage: embedded images are moved to R2; expired
// Telegram entries are replaced in order with fresh links from the source post (other media untouched) and stored.
// GET = plan only, POST = apply. updated_at is left alone so HUB ordering does not change.
export async function repairHubMedia(request,env){
  await ensureSchema(env);const apply=request.method==='POST',report=[];
  const rows=(await env.DB.prepare("SELECT id,title,source_url,media FROM hub_resources WHERE status='published' ORDER BY updated_at DESC").all()).results||[];
  for(const row of rows){
    const media=arr(parseJson(row.media,[])),expired=media.filter(m=>isTelegramMediaUrl(mediaItemUrl(m))).length,embedded=media.filter(m=>isDataImage(mediaItemUrl(m))).length;
    if(!expired&&!embedded)continue;
    const item={id:row.id,title:row.title,source_url:row.source_url,expired_entries:expired,embedded_entries:embedded};report.push(item);
    let next=media;
    if(expired){
      const analyzed=clean(row.source_url)?await analyzeTelegramPost(new Request('https://internal/api/admin/hub-telegram-analyze',{method:'POST',body:JSON.stringify({url:row.source_url})})):null;
      const data=analyzed?await analyzed.json().catch(()=>({})):{},fresh=arr(data.media).map(mediaItemUrl).filter(isTelegramMediaUrl);
      if(fresh.length){
        let k=0;next=[];for(const m of media){if(!isTelegramMediaUrl(mediaItemUrl(m))){next.push(m);continue}if(k<fresh.length){const url=fresh[k++];next.push({...m,url,...(m?.src!=null?{src:url}:{})})}}
        if(next.length&&!next.some(m=>m?.cover))next[0]={...next[0],cover:true};
        item.fresh_images=fresh.length;item.replaced=Math.min(expired,fresh.length);item.dropped=Math.max(0,expired-fresh.length);
      }else item.telegram=clean(row.source_url)?'SOURCE_POST_HAS_NO_MEDIA':'NO_SOURCE_POST';
    }
    if(!apply){item.result='PLANNED';continue}
    const stored=await storeResourceMedia(env,row.id,next),left=stored.filter(m=>needsStoring(mediaItemUrl(m),row.id)).length;
    await env.DB.prepare('UPDATE hub_resources SET media=? WHERE id=?').bind(safeJson(stored),row.id).run();
    item.result=left?'PARTIAL_SOME_IMAGES_NOT_STORED':'REPAIRED';item.not_stored=left;
  }
  return json({ok:true,mode:apply?'apply':'dry-run',resources:report.length,report});
}

async function sourceUrlConflict(env,sourceUrl,resourceId=''){
  const url=clean(sourceUrl);if(!url)return null;
  let row=resourceId
    ?await env.DB.prepare('SELECT id,title,status,source_url FROM hub_resources WHERE source_url=? AND id<>? LIMIT 1').bind(url,resourceId).first()
    :await env.DB.prepare('SELECT id,title,status,source_url FROM hub_resources WHERE source_url=? LIMIT 1').bind(url).first();
  if(row?.id)return row;
  const canonical=normalizeSourceUrl(url),rows=(await env.DB.prepare('SELECT id,title,status,source_url FROM hub_resources').all()).results||[];
  row=rows.find(x=>normalizeSourceUrl(x.source_url)===canonical&&(!resourceId||clean(x.id)!==clean(resourceId)))||null;
  return row;
}
async function removeStaleSourceUrlOwner(env,conflict){
  if(!conflict?.id||clean(conflict.status)==='published')return false;
  const active=await env.DB.prepare('SELECT id FROM hub_resource_publish_sessions WHERE resource_id=? LIMIT 1').bind(conflict.id).first();
  if(active?.id)return false;
  const files=(await env.DB.prepare('SELECT id FROM hub_resource_files WHERE resource_id=?').bind(conflict.id).all()).results||[];
  for(const file of files)await retireStoredFile(env,file.id,conflict.id,'stale-source-url-owner');
  await env.DB.prepare('DELETE FROM hub_resources WHERE id=? AND status<>?').bind(conflict.id,'published').run();
  return true;
}
async function assertSourceUrlAvailable(env,sourceUrl,resourceId=''){
  let conflict=await sourceUrlConflict(env,sourceUrl,resourceId);
  if(conflict?.id&&await removeStaleSourceUrlOwner(env,conflict))conflict=await sourceUrlConflict(env,sourceUrl,resourceId);
  if(conflict?.id){const e=new Error('SOURCE_URL_CONFLICT');e.conflict=conflict;throw e}
}

async function writeResourceRow(env,id,old,d,status='published'){
  await assertSourceUrlAvailable(env,d.sourceUrl,old?.id||'');
  try{
    if(old?.id){
      await env.DB.prepare(`UPDATE hub_resources SET source_url=?,source_type=?,type=?,title=?,creator_name=?,creator_link=?,description_short=?,description_full=?,additional_info=?,models=?,settings=?,tags=?,media=?,confidence=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(d.sourceUrl,d.sourceType,d.type,d.title,d.creatorName,d.creatorLink,d.short,d.full,d.additionalInfo,safeJson(d.models),safeJson(d.settings),safeJson(d.tags),safeJson(d.media),JSON.stringify(d.confidence||{}),status,id).run();return;
    }
    await env.DB.prepare(`INSERT INTO hub_resources(id,source_url,source_type,type,title,creator_name,creator_link,description_short,description_full,additional_info,models,settings,tags,media,confidence,status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(id,d.sourceUrl,d.sourceType,d.type,d.title,d.creatorName,d.creatorLink,d.short,d.full,d.additionalInfo,safeJson(d.models),safeJson(d.settings),safeJson(d.tags),safeJson(d.media),JSON.stringify(d.confidence||{}),status).run();
  }catch(err){
    const msg=String(err?.message||err);
    if(/UNIQUE constraint failed:\s*hub_resources\.source_url|SQLITE_CONSTRAINT_UNIQUE/i.test(msg)){
      let conflict=await sourceUrlConflict(env,d.sourceUrl,old?.id||'');
      if(conflict?.id&&await removeStaleSourceUrlOwner(env,conflict)){
        if(old?.id){await env.DB.prepare(`UPDATE hub_resources SET source_url=?,source_type=?,type=?,title=?,creator_name=?,creator_link=?,description_short=?,description_full=?,additional_info=?,models=?,settings=?,tags=?,media=?,confidence=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(d.sourceUrl,d.sourceType,d.type,d.title,d.creatorName,d.creatorLink,d.short,d.full,d.additionalInfo,safeJson(d.models),safeJson(d.settings),safeJson(d.tags),safeJson(d.media),JSON.stringify(d.confidence||{}),status,id).run();return}
        await env.DB.prepare(`INSERT INTO hub_resources(id,source_url,source_type,type,title,creator_name,creator_link,description_short,description_full,additional_info,models,settings,tags,media,confidence,status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(id,d.sourceUrl,d.sourceType,d.type,d.title,d.creatorName,d.creatorLink,d.short,d.full,d.additionalInfo,safeJson(d.models),safeJson(d.settings),safeJson(d.tags),safeJson(d.media),JSON.stringify(d.confidence||{}),status).run();return
      }
      conflict=conflict||await sourceUrlConflict(env,d.sourceUrl,old?.id||'');
      const e=new Error('SOURCE_URL_CONFLICT');e.conflict=conflict||null;throw e;
    }
    throw err;
  }
}

async function restoreRow(env,row){if(!row?.id)return;await env.DB.prepare(`UPDATE hub_resources SET source_url=?,source_type=?,type=?,title=?,creator_name=?,creator_link=?,description_short=?,description_full=?,additional_info=?,models=?,settings=?,tags=?,media=?,confidence=?,status=?,created_at=?,updated_at=? WHERE id=?`).bind(row.source_url,row.source_type,row.type,row.title,row.creator_name,row.creator_link,row.description_short,row.description_full,row.additional_info||'',row.models,row.settings,row.tags,row.media,row.confidence,row.status||'published',row.created_at,row.updated_at,row.id).run()}

async function ensurePrimary(env,resourceId,preferredId=''){
  if(preferredId){await env.DB.prepare("UPDATE hub_resource_files SET is_primary=0 WHERE resource_id=? AND name NOT LIKE '__extra__%'").bind(resourceId).run();await env.DB.prepare('UPDATE hub_resource_files SET is_primary=1 WHERE id=? AND resource_id=?').bind(preferredId,resourceId).run();return}
  const has=await env.DB.prepare("SELECT id FROM hub_resource_files WHERE resource_id=? AND is_primary=1 AND name NOT LIKE '__extra__%' AND NOT EXISTS(SELECT 1 FROM hub_resource_publish_files sf WHERE sf.file_id=hub_resource_files.id) LIMIT 1").bind(resourceId).first();if(has?.id)return;
  const first=await env.DB.prepare(`SELECT f.id FROM hub_resource_files f WHERE f.resource_id=? AND f.name NOT LIKE '__extra__%' AND NOT EXISTS(SELECT 1 FROM hub_resource_publish_files sf WHERE sf.file_id=f.id) ORDER BY CASE WHEN lower(f.name) LIKE '%.zip' THEN 0 WHEN lower(f.name) LIKE '%.json' THEN 1 WHEN lower(f.name) LIKE '%.txt' THEN 2 ELSE 9 END,f.created_at ASC LIMIT 1`).bind(resourceId).first();
  if(first?.id)await env.DB.prepare('UPDATE hub_resource_files SET is_primary=1 WHERE id=?').bind(first.id).run();
}

async function sessionRow(env,id){return env.DB.prepare('SELECT * FROM hub_resource_publish_sessions WHERE id=? LIMIT 1').bind(id).first()}

async function beginSession(env,draft){
  const d=normalizeDraft(draft);if(!d.sourceUrl||!d.type||!d.title)throw new Error('SOURCE_URL_TYPE_TITLE_REQUIRED');
  let old=null;if(d.editingId)old=await env.DB.prepare('SELECT * FROM hub_resources WHERE id=? LIMIT 1').bind(d.editingId).first();if(!old)old=await env.DB.prepare('SELECT * FROM hub_resources WHERE source_url=? LIMIT 1').bind(d.sourceUrl).first();
  await assertSourceUrlAvailable(env,d.sourceUrl,old?.id||'');
  if(old?.id){const active=await env.DB.prepare('SELECT id FROM hub_resource_publish_sessions WHERE resource_id=? LIMIT 1').bind(old.id).first();if(active?.id){const cancelled=await cancelSession(env,active.id);if(cancelled?.finalizeRequired)throw new Error('PUBLISH_SESSION_FINALIZE_REQUIRED')}}
  const oldPrimary=old?.id?await env.DB.prepare("SELECT id FROM hub_resource_files WHERE resource_id=? AND is_primary=1 AND name NOT LIKE '__extra__%' LIMIT 1").bind(old.id).first():null;
  const id=old?.id||crypto.randomUUID(),sessionId=crypto.randomUUID(),state={version:2,old:old||null,draft:d,oldPrimaryId:oldPrimary?.id||'',phase:'editing'};
  await env.DB.prepare('INSERT INTO hub_resource_publish_sessions(id,resource_id,was_existing,backup) VALUES(?,?,?,?)').bind(sessionId,id,old?1:0,JSON.stringify(state)).run();
  return{sessionId,id,updated:Boolean(old)};
}

async function updateSessionMetadata(env,session,draft){
  const d=normalizeDraft(draft);if(!d.sourceUrl||!d.type||!d.title)throw new Error('SOURCE_URL_TYPE_TITLE_REQUIRED');
  const state=parseSessionState(session);
  if(state.version===2&&state.phase==='committing')throw new Error('PUBLISH_SESSION_FINALIZE_REQUIRED');
  await assertSourceUrlAvailable(env,d.sourceUrl,session.resource_id);
  if(state.version===2){state.draft=d;await saveSessionState(env,session,state)}
  else await writeResourceRow(env,session.resource_id,{id:session.resource_id},d,'staging');
  return{id:session.resource_id};
}

async function projectedTotals(env,session){
  const files=(await env.DB.prepare('SELECT id,name,size FROM hub_resource_files WHERE resource_id=?').bind(session.resource_id).all()).results||[];
  const staged=(await env.DB.prepare('SELECT file_id,replace_old_id FROM hub_resource_publish_files WHERE session_id=?').bind(session.id).all()).results||[];
  const replaced=new Set(staged.map(x=>clean(x.replace_old_id)).filter(Boolean));let normal=0,extra=0;
  for(const f of files){if(replaced.has(f.id))continue;if(isExtraMeta(f.name))extra+=Number(f.size||0);else normal+=Number(f.size||0)}
  return{normal,extra};
}

async function recordStagedFile(env,sessionId,fileId,replaceOldId,isPrimary){await env.DB.prepare('INSERT OR REPLACE INTO hub_resource_publish_files(session_id,file_id,replace_old_id,is_primary) VALUES(?,?,?,?)').bind(sessionId,fileId,replaceOldId||'',isPrimary?1:0).run()}

async function uploadToSession(env,session,parsed){
  const sessionState=parseSessionState(session);if(sessionState.version===2&&sessionState.phase==='committing')throw new Error('PUBLISH_SESSION_FINALIZE_REQUIRED');
  const manifest=arr(parsed.draft?.files),markedName=clean(manifest.find(x=>x&&x.primary&&!x.id)?.name),added=[];
  const addLocal=async(f,isExtra)=>{
    if(Number(f.size||0)>(isExtra?EXTRA_FILE_LIMIT:NORMAL_FILE_LIMIT))throw new Error(isExtra?'EXTRA_IMAGE_TOO_LARGE':'FILE_TOO_LARGE');
    let name=clean(f.name)||`file-${crypto.randomUUID()}`;if(isExtra&&!name.startsWith(EXTRA_PREFIX))name=EXTRA_PREFIX+name;
    const stagedSame=await env.DB.prepare(`SELECT sf.file_id FROM hub_resource_publish_files sf JOIN hub_resource_files f ON f.id=sf.file_id WHERE sf.session_id=? AND lower(f.name)=lower(?) LIMIT 1`).bind(session.id,name).first();
    if(stagedSame?.file_id){await retireStoredFile(env,stagedSame.file_id,session.resource_id,'replace-staged-file');await env.DB.prepare('DELETE FROM hub_resource_publish_files WHERE session_id=? AND file_id=?').bind(session.id,stagedSame.file_id).run()}
    const same=await env.DB.prepare(`SELECT f.id FROM hub_resource_files f WHERE f.resource_id=? AND lower(f.name)=lower(?) AND f.id NOT IN (SELECT file_id FROM hub_resource_publish_files WHERE session_id=?) ORDER BY f.created_at DESC LIMIT 1`).bind(session.resource_id,name,session.id).first();
    const fileId=await storeBuffer(env,{resourceId:session.resource_id,name,mime:f.type,size:Number(f.size)||0,isPrimary:false,buffer:await f.arrayBuffer()});
    await recordStagedFile(env,session.id,fileId,same?.id||'',!isExtra&&markedName===clean(f.name));added.push({id:fileId,name,source:isSourceMeta(name),extra:isExtraMeta(name)&&!isSourceMeta(name)});
  };
  try{
    for(const f of parsed.files)await addLocal(f,false);
    for(const f of parsed.extraImages)await addLocal(f,true);
    for(const rf of parsed.remoteFiles){
      const remoteUrl=clean(rf.url);if(!remoteUrl)continue;const rfName=clean(rf.name)||'telegram-file';
      const same=await env.DB.prepare(`SELECT f.id FROM hub_resource_files f WHERE f.resource_id=? AND lower(f.name)=lower(?) AND f.id NOT IN (SELECT file_id FROM hub_resource_publish_files WHERE session_id=?) ORDER BY f.created_at DESC LIMIT 1`).bind(session.resource_id,rfName,session.id).first();
      const fileId=crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO hub_resource_files(id,resource_id,name,mime,size,is_primary,data,external_url,storage,r2_key) VALUES(?,?,?,?,?,0,NULL,?,'remote','')`).bind(fileId,session.resource_id,rfName,inferMime(rfName,rf.type),Number(rf.size)||0,remoteUrl).run();
      await recordStagedFile(env,session.id,fileId,same?.id||'',markedName===rfName);added.push({id:fileId,name:rfName,source:false,extra:false});
    }
    const totals=await projectedTotals(env,session);if(totals.normal>NORMAL_TOTAL_LIMIT)throw new Error('FILES_TOTAL_TOO_LARGE');if(totals.extra>EXTRA_TOTAL_LIMIT)throw new Error('EXTRAS_TOTAL_TOO_LARGE');
    await env.DB.prepare('UPDATE hub_resource_publish_sessions SET updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(session.id).run();
    return{files:parsed.files.length+parsed.remoteFiles.length,extra_images:parsed.extraImages.length,added_files:added,totals,storage:hasR2(env)?'r2':'d1'};
  }catch(e){
    for(const item of added){const id=item?.id||item;await retireStoredFile(env,id,session.resource_id,'upload-rollback');await env.DB.prepare('DELETE FROM hub_resource_publish_files WHERE session_id=? AND file_id=?').bind(session.id,id).run()}
    throw e;
  }
}

async function cleanupUnreferencedSourceMedia(env,resourceId){
  const resource=await env.DB.prepare('SELECT media FROM hub_resources WHERE id=? LIMIT 1').bind(resourceId).first(),serialized=String(resource?.media||'[]');
  const rows=(await env.DB.prepare("SELECT id FROM hub_resource_files WHERE resource_id=? AND name LIKE '__extra__source__%'").bind(resourceId).all()).results||[];
  for(const row of rows){if(serialized.includes(String(row.id)))continue;await retireStoredFile(env,row.id,resourceId,'source-media-cleanup')}
}

async function finalizeSession(env,sessionId){
  const session=await sessionRow(env,sessionId);if(!session)throw new Error('PUBLISH_SESSION_NOT_FOUND');
  const totals=await projectedTotals(env,session);if(totals.normal>NORMAL_TOTAL_LIMIT)throw new Error('FILES_TOTAL_TOO_LARGE');if(totals.extra>EXTRA_TOTAL_LIMIT)throw new Error('EXTRAS_TOTAL_TOO_LARGE');
  const staged=(await env.DB.prepare('SELECT file_id,replace_old_id,is_primary FROM hub_resource_publish_files WHERE session_id=?').bind(session.id).all()).results||[],state=parseSessionState(session);
  const preferred=staged.find(x=>Number(x.is_primary)===1)?.file_id||'';
  if(state.version===2&&state.phase!=='committing'){
    state.draft.media=await storeResourceMedia(env,session.resource_id,state.draft.media,parseJson(state.old?.media,[]));
    await writeResourceRow(env,session.resource_id,state.old,state.draft,'published');
    if(preferred){await env.DB.prepare("UPDATE hub_resource_files SET is_primary=0 WHERE resource_id=? AND name NOT LIKE '__extra__%'").bind(session.resource_id).run();await env.DB.prepare('UPDATE hub_resource_files SET is_primary=1 WHERE id=? AND resource_id=?').bind(preferred,session.resource_id).run()}else await ensurePrimary(env,session.resource_id);
    state.phase='committing';await saveSessionState(env,session,state);
  }else if(state.version===1){
    await env.DB.prepare("UPDATE hub_resources SET status='published',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(session.resource_id).run();
    if(preferred){await env.DB.prepare("UPDATE hub_resource_files SET is_primary=0 WHERE resource_id=? AND name NOT LIKE '__extra__%'").bind(session.resource_id).run();await env.DB.prepare('UPDATE hub_resource_files SET is_primary=1 WHERE id=? AND resource_id=?').bind(preferred,session.resource_id).run()}else await ensurePrimary(env,session.resource_id);
  }
  for(const s of staged){if(s.replace_old_id&&s.replace_old_id!==s.file_id)await retireStoredFile(env,s.replace_old_id,session.resource_id,'finalize-replaced-file')}
  await cleanupUnreferencedSourceMedia(env,session.resource_id);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM hub_resource_publish_files WHERE session_id=?').bind(session.id),
    env.DB.prepare('DELETE FROM hub_resource_publish_sessions WHERE id=?').bind(session.id)
  ]);
  return{id:session.resource_id,updated:Boolean(session.was_existing),totals};
}

async function cancelSession(env,sessionId){
  const session=await sessionRow(env,sessionId);if(!session)return{cancelled:false};
  const state=parseSessionState(session);
  if(state.version===2&&state.phase==='committing')return{cancelled:false,finalizeRequired:true,id:session.resource_id};
  const staged=(await env.DB.prepare('SELECT file_id FROM hub_resource_publish_files WHERE session_id=?').bind(session.id).all()).results||[];
  for(const s of staged)await retireStoredFile(env,s.file_id,session.resource_id,'cancel-staged-file');
  if(state.version===2){
    if(Number(session.was_existing)&&state.old){
      await restoreRow(env,state.old);
      await env.DB.prepare("UPDATE hub_resource_files SET is_primary=0 WHERE resource_id=? AND name NOT LIKE '__extra__%'").bind(session.resource_id).run();
      if(state.oldPrimaryId)await env.DB.prepare('UPDATE hub_resource_files SET is_primary=1 WHERE id=? AND resource_id=?').bind(state.oldPrimaryId,session.resource_id).run();else await ensurePrimary(env,session.resource_id);
    }else if(!Number(session.was_existing))await env.DB.prepare('DELETE FROM hub_resources WHERE id=?').bind(session.resource_id).run();
  }else{
    const current=await env.DB.prepare('SELECT status FROM hub_resources WHERE id=? LIMIT 1').bind(session.resource_id).first();
    if(current?.status==='published'){try{await env.DB.prepare('DELETE FROM hub_resource_publish_files WHERE session_id=?').bind(session.id).run()}catch{}try{await env.DB.prepare('DELETE FROM hub_resource_publish_sessions WHERE id=?').bind(session.id).run()}catch{}return{cancelled:false,alreadyPublished:true,id:session.resource_id}}
    if(Number(session.was_existing)&&state.old)await restoreRow(env,state.old);else if(!Number(session.was_existing))await env.DB.prepare('DELETE FROM hub_resources WHERE id=?').bind(session.resource_id).run();
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM hub_resource_publish_files WHERE session_id=?').bind(session.id),
    env.DB.prepare('DELETE FROM hub_resource_publish_sessions WHERE id=?').bind(session.id)
  ]);
  return{cancelled:true,id:session.resource_id};
}

async function cleanupStaleSessions(env){const rows=(await env.DB.prepare("SELECT id FROM hub_resource_publish_sessions WHERE datetime(updated_at) < datetime('now','-30 minutes') LIMIT 20").all()).results||[];for(const row of rows){try{const session=await sessionRow(env,row.id),state=parseSessionState(session);if(state.version===2&&state.phase==='committing')await finalizeSession(env,row.id);else await cancelSession(env,row.id)}catch(e){console.error('stale publish recovery failed',row.id,e)}}}

export async function publishHubResource(request,env){
  await ensureSchema(env);const url=new URL(request.url),action=clean(url.searchParams.get('action')).toLowerCase();let parsed;
  try{parsed=await parsePublishRequest(request)}catch(e){return json({ok:false,error:String(e.message||e)},400)}
  try{
    if(action==='begin'){const x=await beginSession(env,parsed.draft);return json({ok:true,session_id:x.sessionId,id:x.id,updated:x.updated,status:'staging',storage:hasR2(env)?'r2':'d1'})}
    if(action==='upload'){const sid=clean(parsed.draft?._publish_session||url.searchParams.get('session'));const session=await sessionRow(env,sid);if(!session)return json({ok:false,error:'PUBLISH_SESSION_NOT_FOUND'},404);const out=await uploadToSession(env,session,parsed);return json({ok:true,session_id:sid,id:session.resource_id,...out,status:'staging'})}
    if(action==='metadata'){const sid=clean(parsed.draft?._publish_session||url.searchParams.get('session'));const session=await sessionRow(env,sid);if(!session)return json({ok:false,error:'PUBLISH_SESSION_NOT_FOUND'},404);const out=await updateSessionMetadata(env,session,parsed.draft);return json({ok:true,session_id:sid,...out,status:'staging'})}
    if(action==='finalize'){const sid=clean(parsed.draft?._publish_session||url.searchParams.get('session'));const out=await finalizeSession(env,sid);return json({ok:true,...out,status:'published'})}
    if(action==='cancel'){const sid=clean(parsed.draft?._publish_session||url.searchParams.get('session')),out=await cancelSession(env,sid);if(out?.finalizeRequired)return json({ok:false,error:'PUBLISH_SESSION_FINALIZE_REQUIRED',...out},409);return json({ok:true,...out})}
    const started=await beginSession(env,parsed.draft);
    try{const session=await sessionRow(env,started.sessionId);await uploadToSession(env,session,parsed);const out=await finalizeSession(env,started.sessionId);return json({ok:true,...out,files:parsed.files.length+parsed.remoteFiles.length,extra_images:parsed.extraImages.length})}
    catch(e){await cancelSession(env,started.sessionId);throw e}
  }catch(e){
    console.error('publishHubResource failed',e);const msg=String(e?.message||e);
    if(msg==='SOURCE_URL_TYPE_TITLE_REQUIRED')return json({ok:false,error:msg},400);
    if(msg==='FILE_TOO_LARGE'||msg==='FILES_TOTAL_TOO_LARGE')return json({ok:false,error:msg,limit:'10 MB per file / 25 MB total'},413);
    if(msg==='EXTRA_IMAGE_TOO_LARGE'||msg==='EXTRAS_TOTAL_TOO_LARGE')return json({ok:false,error:msg,limit:'4 MB per image / 12 MB total'},413);
    if(msg==='PUBLISH_SESSION_FINALIZE_REQUIRED')return json({ok:false,error:msg},409);
    if(msg==='SOURCE_URL_CONFLICT'){const existingId=e?.conflict?.id||'',existingTitle=e?.conflict?.title||'',label=[existingTitle,existingId].filter(Boolean).join(' · '),errorText=label?`SOURCE_URL_CONFLICT: ${label}`:'SOURCE_URL_CONFLICT: another published HUB resource already uses this source URL';return json({ok:false,error:errorText,detail:label||'Another published HUB resource already uses this source URL.',existing_id:existingId,existing_title:existingTitle},409)}
    if(msg==='R2_BINDING_REQUIRED')return json({ok:false,error:msg},503);
    if(/SQLITE_TOOBIG|string or blob too big/i.test(msg))return json({ok:false,error:'D1_CHUNK_WRITE_FAILED',detail:'A storage chunk exceeded D1 limits.'},500);
    return json({ok:false,error:'HUB_RESOURCE_UPDATE_FAILED',detail:msg},500);
  }
}

export async function deleteHubResourceFile(env,resourceId,fileId){
  await ensureSchema(env);const row=await env.DB.prepare('SELECT id,is_primary,name FROM hub_resource_files WHERE id=? AND resource_id=? AND NOT EXISTS(SELECT 1 FROM hub_resource_publish_files sf WHERE sf.file_id=hub_resource_files.id) LIMIT 1').bind(fileId,resourceId).first();
  if(!row)return json({ok:false,error:'FILE_NOT_FOUND'},404);
  try{await deleteStoredFile(env,fileId,resourceId)}catch(e){return json({ok:false,error:String(e?.message||e)},503)}
  if(row.is_primary&&!isExtraMeta(row.name))await ensurePrimary(env,resourceId);return json({ok:true});
}

export async function setHubResourcePrimary(env,resourceId,fileId){await ensureSchema(env);const row=await env.DB.prepare('SELECT id,name FROM hub_resource_files WHERE id=? AND resource_id=? AND NOT EXISTS(SELECT 1 FROM hub_resource_publish_files sf WHERE sf.file_id=hub_resource_files.id) LIMIT 1').bind(fileId,resourceId).first();if(!row)return json({ok:false,error:'FILE_NOT_FOUND'},404);if(isExtraMeta(row.name))return json({ok:false,error:'EXTRA_IMAGE_CANNOT_BE_PRIMARY'},400);await ensurePrimary(env,resourceId,fileId);return json({ok:true})}

export async function deleteHubResource(env,resourceId){
  await ensureSchema(env);const active=await env.DB.prepare('SELECT id FROM hub_resource_publish_sessions WHERE resource_id=? LIMIT 1').bind(resourceId).first();if(active?.id){const cancelled=await cancelSession(env,active.id);if(cancelled?.finalizeRequired)return json({ok:false,error:'PUBLISH_SESSION_FINALIZE_REQUIRED',session_id:active.id},409)}
  const rows=(await env.DB.prepare('SELECT id FROM hub_resource_files WHERE resource_id=?').bind(resourceId).all()).results||[];
  for(const row of rows){try{await deleteStoredFile(env,row.id,resourceId)}catch(e){return json({ok:false,error:String(e?.message||e),file_id:row.id},503)}}
  const resource=await env.DB.prepare('SELECT id FROM hub_resources WHERE id=? LIMIT 1').bind(resourceId).first();if(!resource)return json({ok:false,error:'RESOURCE_NOT_FOUND'},404);
  await env.DB.prepare('DELETE FROM hub_resources WHERE id=?').bind(resourceId).run();return json({ok:true});
}

export async function listHubResources(env){
  await ensureSchema(env);await cleanupStaleSessions(env);
  const res=await env.DB.prepare(`SELECT r.*, (SELECT f.id FROM hub_resource_files f WHERE f.resource_id=r.id AND f.name NOT LIKE '__extra__%' AND NOT EXISTS(SELECT 1 FROM hub_resource_publish_files sf WHERE sf.file_id=f.id) ORDER BY f.is_primary DESC,f.created_at ASC LIMIT 1) primary_file_id,(SELECT COUNT(*) FROM hub_resource_files f WHERE f.resource_id=r.id AND f.name NOT LIKE '__extra__%' AND NOT EXISTS(SELECT 1 FROM hub_resource_publish_files sf WHERE sf.file_id=f.id)) file_count FROM hub_resources r WHERE r.status='published' ORDER BY r.updated_at DESC`).all();
  const fileRes=await env.DB.prepare(`SELECT f.id,f.resource_id,f.name,f.mime,f.size,f.is_primary,f.external_url,f.storage,f.r2_key FROM hub_resource_files f INNER JOIN hub_resources r ON r.id=f.resource_id WHERE r.status='published' AND NOT EXISTS(SELECT 1 FROM hub_resource_publish_files sf WHERE sf.file_id=f.id) ORDER BY f.is_primary DESC,f.created_at ASC`).all(),filesByResource=new Map();
  for(const f of fileRes.results||[]){if(!filesByResource.has(f.resource_id))filesByResource.set(f.resource_id,[]);filesByResource.get(f.resource_id).push({id:f.id,name:f.name,mime:inferMime(f.name,f.mime),size:Number(f.size||0),primary:Boolean(f.is_primary),extra:isExtraMeta(f.name)&&!isSourceMeta(f.name),source:isSourceMeta(f.name),external_url:f.external_url||'',storage:clean(f.storage)||'d1',download_url:`/api/hub-resources/${encodeURIComponent(f.resource_id)}/files/${encodeURIComponent(f.id)}`})}
  const items=(res.results||[]).map(r=>({id:r.id,source_url:r.source_url,type:r.type,title:r.title,creator:{name:r.creator_name,link:r.creator_link},description_short:r.description_short,description_full:r.description_full,additional_info:r.additional_info||'',models:parseJson(r.models),settings:normalizeSettings(parseJson(r.settings)),tags:parseJson(r.tags).filter(x=>clean(x).toLowerCase()!=='magic'),media:parseJson(r.media),primary_file_id:r.primary_file_id||null,file_count:Number(r.file_count||0),files:(filesByResource.get(r.id)||[]).filter(f=>!f.source),source_files:(filesByResource.get(r.id)||[]).filter(f=>f.source),updated_at:r.updated_at}));
  return json({ok:true,resources:items,count:items.length,storage:{r2_available:hasR2(env)}});
}

export async function downloadHubFile(env,resourceId,fileId){
  await ensureSchema(env);const published=await env.DB.prepare("SELECT id FROM hub_resources WHERE id=? AND status='published' LIMIT 1").bind(resourceId).first();if(!published)return json({ok:false,error:'RESOURCE_NOT_FOUND'},404);
  const row=await env.DB.prepare('SELECT id,name,mime,size,data,external_url,storage,r2_key FROM hub_resource_files WHERE id=? AND resource_id=? AND NOT EXISTS(SELECT 1 FROM hub_resource_publish_files sf WHERE sf.file_id=hub_resource_files.id) LIMIT 1').bind(fileId,resourceId).first();if(!row)return json({ok:false,error:'FILE_NOT_FOUND'},404);
  if(row.external_url)return Response.redirect(row.external_url,302);
  const mime=inferMime(row.name,row.mime),extra=isExtraMeta(row.name),headers=new Headers({'content-type':mime,'cache-control':'public, max-age=86400','x-content-type-options':'nosniff'});
  if(!extra)headers.set('content-disposition',`attachment; filename*=UTF-8''${encodeURIComponent(row.name||'download')}`);
  if(clean(row.storage)==='r2'&&clean(row.r2_key)){
    if(!hasR2(env))return json({ok:false,error:'R2_BINDING_REQUIRED'},503);
    const object=await env.HUB_FILES.get(clean(row.r2_key));if(!object)return json({ok:false,error:'R2_OBJECT_MISSING'},404);
    headers.set('content-length',String(object.size));if(object.httpEtag)headers.set('etag',object.httpEtag);
    return new Response(object.body,{status:200,headers});
  }
  let body;try{body=await readD1Body(env,row)}catch(e){return json({ok:false,error:String(e?.message||e)},500)}
  headers.set('content-length',String(body.byteLength));return new Response(body,{status:200,headers});
}
