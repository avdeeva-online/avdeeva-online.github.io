const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=v=>String(v??'').trim();
const arr=v=>Array.isArray(v)?v:[];
const parseJson=(v,fallback=[])=>{try{const x=JSON.parse(v||'');return x??fallback}catch{return fallback}};
const ALLOWED_SETTINGS=new Set(['modern','fantasy','medieval','post-apocalypse','sci-fi','omegaverse','rusreal']);
const normalizeSettings=v=>[...new Set(arr(v).map(x=>{x=clean(x).toLowerCase();if(x==='historical')return'medieval';if(x==='magic')return'fantasy';return x}).filter(x=>ALLOWED_SETTINGS.has(x)))];
const inferMime=(name,mime='')=>{const m=clean(mime).toLowerCase();if(m&&m!=='application/octet-stream')return m;const n=clean(name).toLowerCase();if(/\.webp$/.test(n))return'image/webp';if(/\.png$/.test(n))return'image/png';if(/\.jpe?g$/.test(n))return'image/jpeg';if(/\.gif$/.test(n))return'image/gif';if(/\.svg$/.test(n))return'image/svg+xml';if(/\.json$/.test(n))return'application/json';if(/\.zip$/.test(n))return'application/zip';if(/\.txt$/.test(n))return'text/plain';if(/\.css$/.test(n))return'text/css';return m||'application/octet-stream'};
const isImage=(name,mime)=>/^image\//i.test(inferMime(name,mime))||/\.(png|jpe?g|webp|gif|svg)$/i.test(clean(name));
const isSource=name=>clean(name).startsWith('__extra__source__');
const isExtra=name=>clean(name).startsWith('__extra__')&&!isSource(name);
const mediaUrl=m=>clean(m?.url||m?.src);
const toBytes=v=>{if(v instanceof Uint8Array)return v;if(v instanceof ArrayBuffer)return new Uint8Array(v);if(ArrayBuffer.isView(v))return new Uint8Array(v.buffer,v.byteOffset,v.byteLength);if(Array.isArray(v))return Uint8Array.from(v);return new Uint8Array(0)};
const hasR2=env=>Boolean(env?.HUB_FILES&&typeof env.HUB_FILES.get==='function');
let storageReady=null;
async function ensureStorageColumns(env){if(storageReady)return storageReady;storageReady=(async()=>{try{await env.DB.prepare('SELECT storage,r2_key FROM hub_resource_files LIMIT 1').first()}catch(e){throw new Error(`D1_MIGRATION_REQUIRED:${String(e?.message||e)}`)}})();try{await storageReady}catch(e){storageReady=null;throw e}return storageReady}
function fileUrls(resourceId,fileId){const base=`/api/hub-resources/${encodeURIComponent(resourceId)}/files/${encodeURIComponent(fileId)}`;return{attachment_url:base,view_url:`${base}?view=1`}}
function fileObject(f){const mime=inferMime(f.name,f.mime),urls=fileUrls(f.resource_id,f.id),source=isSource(f.name),extra=isExtra(f.name);return{id:f.id,name:f.name,mime,size:Number(f.size||0),primary:Boolean(f.is_primary),extra,source,explicit_extra:extra,external_url:clean(f.external_url),storage:clean(f.storage)||'d1',attachment_url:urls.attachment_url,view_url:clean(f.external_url)||urls.view_url,download_url:extra&&isImage(f.name,mime)?(clean(f.external_url)||urls.view_url):urls.attachment_url,created_at:f.created_at||''}}
function resourceObject(r,allFiles){const sourceFiles=allFiles.filter(f=>f.source),files=allFiles.filter(f=>!f.source),rawMedia=arr(parseJson(r.media,[])).filter(Boolean),normalFiles=files.filter(f=>!f.extra),normalImages=normalFiles.filter(f=>isImage(f.name,f.mime)),explicitExtras=files.filter(f=>f.extra&&isImage(f.name,f.mime)),sourceImages=sourceFiles.filter(f=>isImage(f.name,f.mime));const selectedMedia=rawMedia.find(m=>m?.cover&&mediaUrl(m)),firstMedia=rawMedia.find(m=>mediaUrl(m)),storedCover=normalImages.find(f=>f.primary)||normalImages[0]||null,coverUrl=mediaUrl(selectedMedia)||mediaUrl(firstMedia)||storedCover?.view_url||'',coverFallbackUrls=[...new Set([...rawMedia.map(mediaUrl),storedCover?.view_url,explicitExtras[0]?.view_url,sourceImages.find(f=>/cover/i.test(f.name))?.view_url,sourceImages[0]?.view_url].map(clean).filter(x=>x&&x!==coverUrl))];let media=rawMedia.map(m=>({...m,cover:mediaUrl(m)===coverUrl}));if(coverUrl&&!media.some(m=>mediaUrl(m)===coverUrl))media=[{url:coverUrl,cover:true,source:'stored-file'},...media.map(m=>({...m,cover:false}))];if(media.length&&!media.some(m=>m.cover))media[0].cover=true;return{id:r.id,source_url:r.source_url,type:r.type,title:r.title,creator:{name:r.creator_name,link:r.creator_link},description_short:r.description_short,description_full:r.description_full,additional_info:r.additional_info||'',models:parseJson(r.models),settings:normalizeSettings(parseJson(r.settings)),tags:arr(parseJson(r.tags)).filter(x=>clean(x).toLowerCase()!=='magic'),media,cover_url:coverUrl,cover_fallback_urls:coverFallbackUrls,primary_file_id:normalFiles.find(f=>f.primary)?.id||null,file_count:normalFiles.length,extra_count:explicitExtras.length,extra_images:explicitExtras,files,source_files:sourceFiles,updated_at:r.updated_at}}

export async function listHubResourcesSummaryPublic(env){
  try{
    await ensureStorageColumns(env);
    const rows=(await env.DB.prepare(`SELECT id,type,title,creator_name,description_short,models,settings,tags,media,updated_at FROM hub_resources WHERE status='published' ORDER BY updated_at DESC`).all()).results||[];
    const fileRows=(await env.DB.prepare(`SELECT f.id,f.resource_id,f.name,f.mime,f.is_primary,f.external_url FROM hub_resource_files f INNER JOIN hub_resources r ON r.id=f.resource_id WHERE r.status='published' AND NOT EXISTS(SELECT 1 FROM hub_resource_publish_files sf WHERE sf.file_id=f.id) ORDER BY f.is_primary DESC,f.created_at ASC`).all()).results||[];
    const info=new Map();for(const f of fileRows){const x=info.get(f.resource_id)||{files:0,cover:'',extraCover:'',sourceCover:''},url=clean(f.external_url)||fileUrls(f.resource_id,f.id).view_url;if(isSource(f.name)){if(!x.sourceCover&&isImage(f.name,f.mime))x.sourceCover=url}else if(isExtra(f.name)){if(!x.extraCover&&isImage(f.name,f.mime))x.extraCover=url}else{x.files++;if(!x.cover&&isImage(f.name,f.mime))x.cover=url}info.set(f.resource_id,x)}
    const resources=rows.map(r=>{const rawMedia=arr(parseJson(r.media,[])).filter(Boolean),selected=rawMedia.find(m=>m?.cover&&mediaUrl(m))||rawMedia.find(m=>mediaUrl(m)),fallback=info.get(r.id)||{files:0,cover:'',extraCover:'',sourceCover:''},coverUrl=mediaUrl(selected)||fallback.cover||'',coverFallbackUrls=[...new Set([...rawMedia.map(mediaUrl),fallback.cover,fallback.extraCover,fallback.sourceCover].map(clean).filter(x=>x&&x!==coverUrl))];return{id:r.id,type:r.type,title:r.title,creator:{name:r.creator_name},description_short:r.description_short,models:parseJson(r.models),settings:normalizeSettings(parseJson(r.settings)),tags:arr(parseJson(r.tags)).filter(x=>clean(x).toLowerCase()!=='magic'),cover_url:coverUrl,cover_fallback_urls:coverFallbackUrls,file_count:fallback.files,updated_at:r.updated_at}});
    return json({ok:true,resources,count:resources.length,payload_model:'hub-summary-v1'});
  }catch(e){console.error('listHubResourcesSummaryPublic failed',e);return json({ok:false,error:'HUB_RESOURCE_LIST_FAILED',detail:String(e?.message||e)},500)}
}

export async function listHubResourcesPublic(env){
  try{
    await ensureStorageColumns(env);
    const res=await env.DB.prepare(`SELECT r.* FROM hub_resources r WHERE r.status='published' ORDER BY r.updated_at DESC`).all();
    const fileRes=await env.DB.prepare(`SELECT f.id,f.resource_id,f.name,f.mime,f.size,f.is_primary,f.external_url,f.storage,f.r2_key,f.created_at FROM hub_resource_files f INNER JOIN hub_resources r ON r.id=f.resource_id WHERE r.status='published' AND NOT EXISTS(SELECT 1 FROM hub_resource_publish_files sf WHERE sf.file_id=f.id) ORDER BY f.is_primary DESC,f.created_at ASC`).all();
    const byResource=new Map();for(const f of fileRes.results||[]){const obj=fileObject(f);if(!byResource.has(f.resource_id))byResource.set(f.resource_id,[]);byResource.get(f.resource_id).push(obj)}
    const resources=(res.results||[]).map(r=>resourceObject(r,byResource.get(r.id)||[]));
    return json({ok:true,resources,count:resources.length,media_model:6,storage:{r2_available:hasR2(env)}});
  }catch(e){console.error('listHubResourcesPublic failed',e);return json({ok:false,error:'HUB_RESOURCE_LIST_FAILED',detail:String(e?.message||e)},500)}
}

export async function getHubResourcePublic(env,resourceId){
  try{
    await ensureStorageColumns(env);
    const row=await env.DB.prepare(`SELECT * FROM hub_resources WHERE id=? AND status='published' LIMIT 1`).bind(resourceId).first();if(!row)return json({ok:false,error:'RESOURCE_NOT_FOUND'},404);
    const fileRows=(await env.DB.prepare(`SELECT id,resource_id,name,mime,size,is_primary,external_url,storage,r2_key,created_at FROM hub_resource_files f WHERE resource_id=? AND NOT EXISTS(SELECT 1 FROM hub_resource_publish_files sf WHERE sf.file_id=f.id) ORDER BY is_primary DESC,created_at ASC`).bind(resourceId).all()).results||[];
    return json({ok:true,resource:resourceObject(row,fileRows.map(fileObject)),payload_model:'hub-detail-v1'});
  }catch(e){console.error('getHubResourcePublic failed',e);return json({ok:false,error:'HUB_RESOURCE_READ_FAILED',detail:String(e?.message||e)},500)}
}

export async function downloadHubFilePublic(request,env,resourceId,fileId){
  try{
    await ensureStorageColumns(env);
    const row=await env.DB.prepare(`SELECT f.id,f.name,f.mime,f.size,f.data,f.external_url,f.storage,f.r2_key FROM hub_resource_files f INNER JOIN hub_resources r ON r.id=f.resource_id WHERE f.id=? AND f.resource_id=? AND r.status='published' AND NOT EXISTS(SELECT 1 FROM hub_resource_publish_files sf WHERE sf.file_id=f.id) LIMIT 1`).bind(fileId,resourceId).first();
    if(!row)return json({ok:false,error:'FILE_NOT_FOUND'},404);
    if(row.external_url)return Response.redirect(row.external_url,302);
    const mime=inferMime(row.name,row.mime),url=new URL(request.url),view=url.searchParams.get('view')==='1',inline=view&&isImage(row.name,mime),headers=new Headers({'content-type':mime,'cache-control':'public, max-age=86400','x-content-type-options':'nosniff'});
    headers.set('content-disposition',`${inline?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(clean(row.name)||(inline?'image':'download'))}`);
    if(clean(row.storage)==='r2'&&clean(row.r2_key)){
      if(!hasR2(env))return json({ok:false,error:'R2_BINDING_REQUIRED'},503);
      const object=await env.HUB_FILES.get(clean(row.r2_key));if(!object)return json({ok:false,error:'R2_OBJECT_MISSING'},404);
      headers.set('content-length',String(object.size));if(object.httpEtag)headers.set('etag',object.httpEtag);
      return new Response(object.body,{status:200,headers});
    }
    let body;
    if(row.data!=null){body=toBytes(row.data);if(!body.byteLength&&Number(row.size||0)>0)return json({ok:false,error:'FILE_DATA_INVALID'},500)}
    else{const chunks=await env.DB.prepare('SELECT data FROM hub_resource_file_chunks WHERE file_id=? ORDER BY chunk_index ASC').bind(fileId).all();if(!(chunks.results||[]).length){if(Number(row.size||0)===0)body=new Uint8Array(0);else return json({ok:false,error:'FILE_DATA_MISSING'},404)}else{const parts=(chunks.results||[]).map(x=>toBytes(x.data)),total=parts.reduce((n,p)=>n+p.byteLength,0),joined=new Uint8Array(total);let offset=0;for(const p of parts){joined.set(p,offset);offset+=p.byteLength}body=joined}}
    headers.set('content-length',String(body.byteLength));return new Response(body,{status:200,headers});
  }catch(e){console.error('downloadHubFilePublic failed',e);return json({ok:false,error:'HUB_FILE_READ_FAILED',detail:String(e?.message||e)},500)}
}

export async function hubMediaAudit(env){
  try{
    const response=await listHubResourcesPublic(env),data=await response.clone().json();if(!response.ok||!data.ok)return response;
    const storage={d1:0,r2:0,remote:0};for(const r of data.resources)for(const f of [...arr(r.files),...arr(r.source_files)]){const k=f.external_url?'remote':(f.storage==='r2'?'r2':'d1');storage[k]=(storage[k]||0)+1}
    return json({ok:true,count:data.resources.length,storage,r2_available:hasR2(env),resources:data.resources.map(r=>({id:r.id,title:r.title,cover:Boolean(r.cover_url),media_count:arr(r.media).length,source_media_files:arr(r.source_files).length,file_count:arr(r.files).filter(f=>!f.extra).length,image_files:arr(r.files).filter(f=>isImage(f.name,f.mime)&&!f.extra).length,extras:arr(r.files).filter(f=>f.extra&&isImage(f.name,f.mime)).length}))});
  }catch(e){return json({ok:false,error:'HUB_MEDIA_AUDIT_FAILED',detail:String(e?.message||e)},500)}
}
