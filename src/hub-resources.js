import { requireD1Schema } from './d1-schema.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=v=>String(v??'').trim();
const arr=v=>Array.isArray(v)?v:[];
const safeJson=v=>{try{return JSON.stringify(v??[])}catch{return'[]'}};
const parseJson=(v,fallback=[])=>{try{const x=JSON.parse(v||'');return x??fallback}catch{return fallback}};
const ALLOWED_SETTINGS=new Set(['modern','fantasy','medieval','post-apocalypse','sci-fi','omegaverse','rusreal']);
const EXTRA_PREFIX='__extra__';
const CHUNK_SIZE=768*1024;
const NORMAL_TOTAL_LIMIT=25*1024*1024;
const NORMAL_FILE_LIMIT=10*1024*1024;
const EXTRA_TOTAL_LIMIT=12*1024*1024;
const EXTRA_FILE_LIMIT=4*1024*1024;
const normalizeSettings=v=>[...new Set(arr(v).map(x=>{x=clean(x).toLowerCase();if(x==='historical')return'medieval';if(x==='magic')return'fantasy';return x}).filter(x=>ALLOWED_SETTINGS.has(x)))];
const isExtraMeta=name=>clean(name).startsWith(EXTRA_PREFIX);
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

function normalizeDraft(d){const source=d?.source||{};return{editingId:clean(d?.editing_id),sourceUrl:clean(source.url),sourceType:clean(source.type)||'telegram',type:clean(d?.type).toLowerCase(),title:clean(d?.title),creatorName:clean(d?.creator?.name),creatorLink:clean(d?.creator?.link),short:clean(d?.description_short),full:clean(d?.description_full),additionalInfo:clean(d?.additional_info),models:arr(d?.models).map(clean).filter(Boolean),settings:normalizeSettings(d?.settings),tags:arr(d?.tags).map(clean).filter(Boolean),media:arr(d?.media),confidence:d?.confidence&&typeof d.confidence==='object'?d.confidence:{}}}

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
  }catch(e){try{await deleteStoredFile(env,fileId,resourceId)}catch{}throw e}
}

async function writeResourceRow(env,id,old,d,status='published'){
  if(old?.id){
    await env.DB.prepare(`UPDATE hub_resources SET source_url=?,source_type=?,type=?,title=?,creator_name=?,creator_link=?,description_short=?,description_full=?,additional_info=?,models=?,settings=?,tags=?,media=?,confidence=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(d.sourceUrl,d.sourceType,d.type,d.title,d.creatorName,d.creatorLink,d.short,d.full,d.additionalInfo,safeJson(d.models),safeJson(d.settings),safeJson(d.tags),safeJson(d.media),JSON.stringify(d.confidence||{}),status,id).run();return;
  }
  await env.DB.prepare(`INSERT INTO hub_resources(id,source_url,source_type,type,title,creator_name,creator_link,description_short,description_full,additional_info,models,settings,tags,media,confidence,status,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(id,d.sourceUrl,d.sourceType,d.type,d.title,d.creatorName,d.creatorLink,d.short,d.full,d.additionalInfo,safeJson(d.models),safeJson(d.settings),safeJson(d.tags),safeJson(d.media),JSON.stringify(d.confidence||{}),status).run();
}

async function restoreRow(env,row){if(!row?.id)return;await env.DB.prepare(`UPDATE hub_resources SET source_url=?,source_type=?,type=?,title=?,creator_name=?,creator_link=?,description_short=?,description_full=?,additional_info=?,models=?,settings=?,tags=?,media=?,confidence=?,status=?,created_at=?,updated_at=? WHERE id=?`).bind(row.source_url,row.source_type,row.type,row.title,row.creator_name,row.creator_link,row.description_short,row.description_full,row.additional_info||'',row.models,row.settings,row.tags,row.media,row.confidence,row.status||'published',row.created_at,row.updated_at,row.id).run()}

async function ensurePrimary(env,resourceId,preferredId=''){
  if(preferredId){await env.DB.prepare("UPDATE hub_resource_files SET is_primary=0 WHERE resource_id=? AND name NOT LIKE '__extra__%'").bind(resourceId).run();await env.DB.prepare('UPDATE hub_resource_files SET is_primary=1 WHERE id=? AND resource_id=?').bind(preferredId,resourceId).run();return}
  const has=await env.DB.prepare("SELECT id FROM hub_resource_files WHERE resource_id=? AND is_primary=1 AND name NOT LIKE '__extra__%' LIMIT 1").bind(resourceId).first();if(has?.id)return;
  const first=await env.DB.prepare(`SELECT id FROM hub_resource_files WHERE resource_id=? AND name NOT LIKE '__extra__%' ORDER BY CASE WHEN lower(name) LIKE '%.zip' THEN 0 WHEN lower(name) LIKE '%.json' THEN 1 WHEN lower(name) LIKE '%.txt' THEN 2 ELSE 9 END,created_at ASC LIMIT 1`).bind(resourceId).first();
  if(first?.id)await env.DB.prepare('UPDATE hub_resource_files SET is_primary=1 WHERE id=?').bind(first.id).run();
}

async function sessionRow(env,id){return env.DB.prepare('SELECT * FROM hub_resource_publish_sessions WHERE id=? LIMIT 1').bind(id).first()}

async function beginSession(env,draft){
  const d=normalizeDraft(draft);if(!d.sourceUrl||!d.type||!d.title)throw new Error('SOURCE_URL_TYPE_TITLE_REQUIRED');
  let old=null;if(d.editingId)old=await env.DB.prepare('SELECT * FROM hub_resources WHERE id=? LIMIT 1').bind(d.editingId).first();if(!old)old=await env.DB.prepare('SELECT * FROM hub_resources WHERE source_url=? LIMIT 1').bind(d.sourceUrl).first();
  if(old?.id){const active=await env.DB.prepare('SELECT id FROM hub_resource_publish_sessions WHERE resource_id=? LIMIT 1').bind(old.id).first();if(active?.id)await cancelSession(env,active.id)}
  const id=old?.id||crypto.randomUUID(),sessionId=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO hub_resource_publish_sessions(id,resource_id,was_existing,backup) VALUES(?,?,?,?)').bind(sessionId,id,old?1:0,old?JSON.stringify(old):'').run();
  try{await writeResourceRow(env,id,old,d,'staging')}catch(e){await env.DB.prepare('DELETE FROM hub_resource_publish_sessions WHERE id=?').bind(sessionId).run();throw e}
  return{sessionId,id,updated:Boolean(old)};
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
  const manifest=arr(parsed.draft?.files),markedName=clean(manifest.find(x=>x&&x.primary&&!x.id)?.name),added=[];
  const addLocal=async(f,isExtra)=>{
    if(Number(f.size||0)>(isExtra?EXTRA_FILE_LIMIT:NORMAL_FILE_LIMIT))throw new Error(isExtra?'EXTRA_IMAGE_TOO_LARGE':'FILE_TOO_LARGE');
    let name=clean(f.name)||`file-${crypto.randomUUID()}`;if(isExtra&&!name.startsWith(EXTRA_PREFIX))name=EXTRA_PREFIX+name;
    const stagedSame=await env.DB.prepare(`SELECT sf.file_id FROM hub_resource_publish_files sf JOIN hub_resource_files f ON f.id=sf.file_id WHERE sf.session_id=? AND lower(f.name)=lower(?) LIMIT 1`).bind(session.id,name).first();
    if(stagedSame?.file_id){await deleteStoredFile(env,stagedSame.file_id,session.resource_id);await env.DB.prepare('DELETE FROM hub_resource_publish_files WHERE session_id=? AND file_id=?').bind(session.id,stagedSame.file_id).run()}
    const same=await env.DB.prepare(`SELECT f.id FROM hub_resource_files f WHERE f.resource_id=? AND lower(f.name)=lower(?) AND f.id NOT IN (SELECT file_id FROM hub_resource_publish_files WHERE session_id=?) ORDER BY f.created_at DESC LIMIT 1`).bind(session.resource_id,name,session.id).first();
    const fileId=await storeBuffer(env,{resourceId:session.resource_id,name,mime:f.type,size:Number(f.size)||0,isPrimary:false,buffer:await f.arrayBuffer()});
    await recordStagedFile(env,session.id,fileId,same?.id||'',!isExtra&&markedName===clean(f.name));added.push(fileId);
  };
  try{
    for(const f of parsed.files)await addLocal(f,false);
    for(const f of parsed.extraImages)await addLocal(f,true);
    for(const rf of parsed.remoteFiles){
      const remoteUrl=clean(rf.url);if(!remoteUrl)continue;const rfName=clean(rf.name)||'telegram-file';
      const same=await env.DB.prepare(`SELECT f.id FROM hub_resource_files f WHERE f.resource_id=? AND lower(f.name)=lower(?) AND f.id NOT IN (SELECT file_id FROM hub_resource_publish_files WHERE session_id=?) ORDER BY f.created_at DESC LIMIT 1`).bind(session.resource_id,rfName,session.id).first();
      const fileId=crypto.randomUUID();
      await env.DB.prepare(`INSERT INTO hub_resource_files(id,resource_id,name,mime,size,is_primary,data,external_url,storage,r2_key) VALUES(?,?,?,?,?,0,NULL,?,'remote','')`).bind(fileId,session.resource_id,rfName,inferMime(rfName,rf.type),Number(rf.size)||0,remoteUrl).run();
      await recordStagedFile(env,session.id,fileId,same?.id||'',markedName===rfName);added.push(fileId);
    }
    const totals=await projectedTotals(env,session);if(totals.normal>NORMAL_TOTAL_LIMIT)throw new Error('FILES_TOTAL_TOO_LARGE');if(totals.extra>EXTRA_TOTAL_LIMIT)throw new Error('EXTRAS_TOTAL_TOO_LARGE');
    await env.DB.prepare('UPDATE hub_resource_publish_sessions SET updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(session.id).run();
    return{files:parsed.files.length+parsed.remoteFiles.length,extra_images:parsed.extraImages.length,totals,storage:hasR2(env)?'r2':'d1'};
  }catch(e){
    for(const id of added){try{await deleteStoredFile(env,id,session.resource_id)}catch{}try{await env.DB.prepare('DELETE FROM hub_resource_publish_files WHERE session_id=? AND file_id=?').bind(session.id,id).run()}catch{}}
    throw e;
  }
}

async function finalizeSession(env,sessionId){
  const session=await sessionRow(env,sessionId);if(!session)throw new Error('PUBLISH_SESSION_NOT_FOUND');
  const totals=await projectedTotals(env,session);if(totals.normal>NORMAL_TOTAL_LIMIT)throw new Error('FILES_TOTAL_TOO_LARGE');if(totals.extra>EXTRA_TOTAL_LIMIT)throw new Error('EXTRAS_TOTAL_TOO_LARGE');
  const staged=(await env.DB.prepare('SELECT file_id,replace_old_id,is_primary FROM hub_resource_publish_files WHERE session_id=?').bind(session.id).all()).results||[];
  const preferred=staged.find(x=>Number(x.is_primary)===1)?.file_id||'';
  await ensurePrimary(env,session.resource_id,preferred);
  await env.DB.prepare("UPDATE hub_resources SET status='published',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(session.resource_id).run();
  for(const s of staged){if(s.replace_old_id&&s.replace_old_id!==s.file_id){try{await deleteStoredFile(env,s.replace_old_id,session.resource_id)}catch(e){console.error('published resource old-file cleanup failed',s.replace_old_id,e)}}}
  try{await env.DB.prepare('DELETE FROM hub_resource_publish_files WHERE session_id=?').bind(session.id).run()}catch(e){console.error('publish session file cleanup failed',session.id,e)}
  try{await env.DB.prepare('DELETE FROM hub_resource_publish_sessions WHERE id=?').bind(session.id).run()}catch(e){console.error('publish session cleanup failed',session.id,e)}
  return{id:session.resource_id,updated:Boolean(session.was_existing),totals};
}

async function cancelSession(env,sessionId){
  const session=await sessionRow(env,sessionId);if(!session)return{cancelled:false};
  const current=await env.DB.prepare('SELECT status FROM hub_resources WHERE id=? LIMIT 1').bind(session.resource_id).first();
  if(current?.status==='published'){try{await env.DB.prepare('DELETE FROM hub_resource_publish_files WHERE session_id=?').bind(session.id).run()}catch{}try{await env.DB.prepare('DELETE FROM hub_resource_publish_sessions WHERE id=?').bind(session.id).run()}catch{}return{cancelled:false,alreadyPublished:true,id:session.resource_id}}
  const staged=(await env.DB.prepare('SELECT file_id FROM hub_resource_publish_files WHERE session_id=?').bind(session.id).all()).results||[];
  for(const s of staged){try{await deleteStoredFile(env,s.file_id,session.resource_id)}catch(e){console.error('staged file cleanup failed',s.file_id,e)}}
  if(Number(session.was_existing)){let backup=null;try{backup=JSON.parse(session.backup||'null')}catch{}if(backup)await restoreRow(env,backup);else await env.DB.prepare("UPDATE hub_resources SET status='published' WHERE id=?").bind(session.resource_id).run()}
  else await env.DB.prepare('DELETE FROM hub_resources WHERE id=?').bind(session.resource_id).run();
  await env.DB.prepare('DELETE FROM hub_resource_publish_files WHERE session_id=?').bind(session.id).run();
  await env.DB.prepare('DELETE FROM hub_resource_publish_sessions WHERE id=?').bind(session.id).run();
  return{cancelled:true,id:session.resource_id};
}

async function cleanupStaleSessions(env){const rows=(await env.DB.prepare("SELECT id FROM hub_resource_publish_sessions WHERE datetime(updated_at) < datetime('now','-30 minutes') LIMIT 20").all()).results||[];for(const row of rows){try{await cancelSession(env,row.id)}catch(e){console.error('stale publish rollback failed',row.id,e)}}}

export async function publishHubResource(request,env){
  await ensureSchema(env);const url=new URL(request.url),action=clean(url.searchParams.get('action')).toLowerCase();let parsed;
  try{parsed=await parsePublishRequest(request)}catch(e){return json({ok:false,error:String(e.message||e)},400)}
  try{
    if(action==='begin'){const x=await beginSession(env,parsed.draft);return json({ok:true,session_id:x.sessionId,id:x.id,updated:x.updated,status:'staging',storage:hasR2(env)?'r2':'d1'})}
    if(action==='upload'){const sid=clean(parsed.draft?._publish_session||url.searchParams.get('session'));const session=await sessionRow(env,sid);if(!session)return json({ok:false,error:'PUBLISH_SESSION_NOT_FOUND'},404);const out=await uploadToSession(env,session,parsed);return json({ok:true,session_id:sid,id:session.resource_id,...out,status:'staging'})}
    if(action==='finalize'){const sid=clean(parsed.draft?._publish_session||url.searchParams.get('session'));const out=await finalizeSession(env,sid);return json({ok:true,...out,status:'published'})}
    if(action==='cancel'){const sid=clean(parsed.draft?._publish_session||url.searchParams.get('session'));return json({ok:true,...await cancelSession(env,sid)})}
    const started=await beginSession(env,parsed.draft);
    try{const session=await sessionRow(env,started.sessionId);await uploadToSession(env,session,parsed);const out=await finalizeSession(env,started.sessionId);return json({ok:true,...out,files:parsed.files.length+parsed.remoteFiles.length,extra_images:parsed.extraImages.length})}
    catch(e){await cancelSession(env,started.sessionId);throw e}
  }catch(e){
    console.error('publishHubResource failed',e);const msg=String(e?.message||e);
    if(msg==='SOURCE_URL_TYPE_TITLE_REQUIRED')return json({ok:false,error:msg},400);
    if(msg==='FILE_TOO_LARGE'||msg==='FILES_TOTAL_TOO_LARGE')return json({ok:false,error:msg,limit:'10 MB per file / 25 MB total'},413);
    if(msg==='EXTRA_IMAGE_TOO_LARGE'||msg==='EXTRAS_TOTAL_TOO_LARGE')return json({ok:false,error:msg,limit:'4 MB per image / 12 MB total'},413);
    if(msg==='R2_BINDING_REQUIRED')return json({ok:false,error:msg},503);
    if(/SQLITE_TOOBIG|string or blob too big/i.test(msg))return json({ok:false,error:'D1_CHUNK_WRITE_FAILED',detail:'A storage chunk exceeded D1 limits.'},500);
    return json({ok:false,error:'HUB_RESOURCE_UPDATE_FAILED',detail:msg},500);
  }
}

export async function deleteHubResourceFile(env,resourceId,fileId){
  await ensureSchema(env);const row=await env.DB.prepare('SELECT id,is_primary,name FROM hub_resource_files WHERE id=? AND resource_id=? LIMIT 1').bind(fileId,resourceId).first();
  if(!row)return json({ok:false,error:'FILE_NOT_FOUND'},404);
  try{await deleteStoredFile(env,fileId,resourceId)}catch(e){return json({ok:false,error:String(e?.message||e)},503)}
  if(row.is_primary&&!isExtraMeta(row.name))await ensurePrimary(env,resourceId);return json({ok:true});
}

export async function setHubResourcePrimary(env,resourceId,fileId){await ensureSchema(env);const row=await env.DB.prepare('SELECT id,name FROM hub_resource_files WHERE id=? AND resource_id=? LIMIT 1').bind(fileId,resourceId).first();if(!row)return json({ok:false,error:'FILE_NOT_FOUND'},404);if(isExtraMeta(row.name))return json({ok:false,error:'EXTRA_IMAGE_CANNOT_BE_PRIMARY'},400);await ensurePrimary(env,resourceId,fileId);return json({ok:true})}

export async function deleteHubResource(env,resourceId){
  await ensureSchema(env);const active=await env.DB.prepare('SELECT id FROM hub_resource_publish_sessions WHERE resource_id=? LIMIT 1').bind(resourceId).first();if(active?.id)await cancelSession(env,active.id);
  const rows=(await env.DB.prepare('SELECT id FROM hub_resource_files WHERE resource_id=?').bind(resourceId).all()).results||[];
  for(const row of rows){try{await deleteStoredFile(env,row.id,resourceId)}catch(e){return json({ok:false,error:String(e?.message||e),file_id:row.id},503)}}
  const resource=await env.DB.prepare('SELECT id FROM hub_resources WHERE id=? LIMIT 1').bind(resourceId).first();if(!resource)return json({ok:false,error:'RESOURCE_NOT_FOUND'},404);
  await env.DB.prepare('DELETE FROM hub_resources WHERE id=?').bind(resourceId).run();return json({ok:true});
}

export async function listHubResources(env){
  await ensureSchema(env);await cleanupStaleSessions(env);
  const res=await env.DB.prepare(`SELECT r.*, (SELECT id FROM hub_resource_files f WHERE f.resource_id=r.id AND f.name NOT LIKE '__extra__%' ORDER BY is_primary DESC,created_at ASC LIMIT 1) primary_file_id,(SELECT COUNT(*) FROM hub_resource_files f WHERE f.resource_id=r.id AND f.name NOT LIKE '__extra__%') file_count FROM hub_resources r WHERE status='published' ORDER BY updated_at DESC`).all();
  const fileRes=await env.DB.prepare(`SELECT f.id,f.resource_id,f.name,f.mime,f.size,f.is_primary,f.external_url,f.storage,f.r2_key FROM hub_resource_files f INNER JOIN hub_resources r ON r.id=f.resource_id WHERE r.status='published' ORDER BY f.is_primary DESC,f.created_at ASC`).all(),filesByResource=new Map();
  for(const f of fileRes.results||[]){if(!filesByResource.has(f.resource_id))filesByResource.set(f.resource_id,[]);filesByResource.get(f.resource_id).push({id:f.id,name:f.name,mime:inferMime(f.name,f.mime),size:Number(f.size||0),primary:Boolean(f.is_primary),extra:isExtraMeta(f.name),external_url:f.external_url||'',storage:clean(f.storage)||'d1',download_url:`/api/hub-resources/${encodeURIComponent(f.resource_id)}/files/${encodeURIComponent(f.id)}`})}
  const items=(res.results||[]).map(r=>({id:r.id,source_url:r.source_url,type:r.type,title:r.title,creator:{name:r.creator_name,link:r.creator_link},description_short:r.description_short,description_full:r.description_full,additional_info:r.additional_info||'',models:parseJson(r.models),settings:normalizeSettings(parseJson(r.settings)),tags:parseJson(r.tags).filter(x=>clean(x).toLowerCase()!=='magic'),media:parseJson(r.media),primary_file_id:r.primary_file_id||null,file_count:Number(r.file_count||0),files:filesByResource.get(r.id)||[],updated_at:r.updated_at}));
  return json({ok:true,resources:items,count:items.length,storage:{r2_available:hasR2(env)}});
}

export async function downloadHubFile(env,resourceId,fileId){
  await ensureSchema(env);const published=await env.DB.prepare("SELECT id FROM hub_resources WHERE id=? AND status='published' LIMIT 1").bind(resourceId).first();if(!published)return json({ok:false,error:'RESOURCE_NOT_FOUND'},404);
  const row=await env.DB.prepare('SELECT id,name,mime,size,data,external_url,storage,r2_key FROM hub_resource_files WHERE id=? AND resource_id=? LIMIT 1').bind(fileId,resourceId).first();if(!row)return json({ok:false,error:'FILE_NOT_FOUND'},404);
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

export async function hubStorageStatus(env){
  await ensureSchema(env);
  const groups=(await env.DB.prepare(`SELECT CASE WHEN external_url!='' THEN 'remote' WHEN storage='r2' AND r2_key!='' THEN 'r2' ELSE 'd1' END AS storage_kind,COUNT(*) AS files,COALESCE(SUM(size),0) AS bytes FROM hub_resource_files GROUP BY storage_kind`).all()).results||[];
  const pending=Number((await env.DB.prepare(`SELECT COUNT(*) AS n FROM hub_resource_files WHERE external_url='' AND (storage IS NULL OR storage='' OR storage='d1')`).first())?.n||0);
  return json({ok:true,r2_available:hasR2(env),pending_d1_files:pending,groups:groups.map(x=>({storage:x.storage_kind,files:Number(x.files||0),bytes:Number(x.bytes||0)}))});
}

export async function migrateHubFilesToR2(request,env){
  await ensureSchema(env);if(!hasR2(env))return json({ok:false,error:'R2_BINDING_REQUIRED',message:'Bind an R2 bucket as HUB_FILES before migration.'},503);
  let body={};try{body=await request.json()}catch{}
  const limit=Math.max(1,Math.min(25,Number(body?.limit)||10)),dryRun=Boolean(body?.dry_run);
  const rows=(await env.DB.prepare(`SELECT id,resource_id,name,mime,size,data,external_url,storage,r2_key FROM hub_resource_files WHERE external_url='' AND (storage IS NULL OR storage='' OR storage='d1') ORDER BY created_at ASC LIMIT ?`).bind(limit).all()).results||[];
  const migrated=[],errors=[];
  for(const row of rows){
    const key=r2Key(row.resource_id,row.id,row.name);
    if(dryRun){migrated.push({id:row.id,name:row.name,size:Number(row.size||0),key,dry_run:true});continue}
    try{
      const bytes=await readD1Body(env,row);
      await env.HUB_FILES.put(key,bytes,{httpMetadata:{contentType:inferMime(row.name,row.mime)},customMetadata:{resourceId:row.resource_id,fileId:row.id,name:row.name}});
      try{
        await env.DB.prepare(`UPDATE hub_resource_files SET storage='r2',r2_key=?,data=NULL WHERE id=?`).bind(key,row.id).run();
        await env.DB.prepare('DELETE FROM hub_resource_file_chunks WHERE file_id=?').bind(row.id).run();
      }catch(e){try{await env.HUB_FILES.delete(key)}catch{}throw e}
      migrated.push({id:row.id,name:row.name,size:Number(row.size||0),key});
    }catch(e){errors.push({id:row.id,name:row.name,error:String(e?.message||e)})}
  }
  const remaining=Number((await env.DB.prepare(`SELECT COUNT(*) AS n FROM hub_resource_files WHERE external_url='' AND (storage IS NULL OR storage='' OR storage='d1')`).first())?.n||0);
  return json({ok:errors.length===0,dry_run:dryRun,processed:rows.length,migrated:migrated.length,errors,remaining,r2_available:true},errors.length?207:200);
}

export async function injectHubResources(response){return response;}