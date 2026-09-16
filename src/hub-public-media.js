const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=v=>String(v??'').trim();
const arr=v=>Array.isArray(v)?v:[];
const parseJson=(v,fallback=[])=>{try{const x=JSON.parse(v||'');return x??fallback}catch{return fallback}};
const ALLOWED_SETTINGS=new Set(['modern','fantasy','medieval','post-apocalypse','sci-fi','omegaverse','rusreal']);
const normalizeSettings=v=>[...new Set(arr(v).map(x=>{x=clean(x).toLowerCase();if(x==='historical')return'medieval';if(x==='magic')return'fantasy';return x}).filter(x=>ALLOWED_SETTINGS.has(x)))];
const inferMime=(name,mime='')=>{const m=clean(mime).toLowerCase();if(m&&m!=='application/octet-stream')return m;const n=clean(name).toLowerCase();if(/\.webp$/.test(n))return'image/webp';if(/\.png$/.test(n))return'image/png';if(/\.jpe?g$/.test(n))return'image/jpeg';if(/\.gif$/.test(n))return'image/gif';if(/\.svg$/.test(n))return'image/svg+xml';if(/\.json$/.test(n))return'application/json';if(/\.zip$/.test(n))return'application/zip';if(/\.txt$/.test(n))return'text/plain';if(/\.css$/.test(n))return'text/css';return m||'application/octet-stream'};
const isImage=(name,mime)=>/^image\//i.test(inferMime(name,mime))||/\.(png|jpe?g|webp|gif|svg)$/i.test(clean(name));
const isExtra=name=>clean(name).startsWith('__extra__');
const mediaUrl=m=>clean(m?.url||m?.src);
const toBytes=v=>{if(v instanceof Uint8Array)return v;if(v instanceof ArrayBuffer)return new Uint8Array(v);if(ArrayBuffer.isView(v))return new Uint8Array(v.buffer,v.byteOffset,v.byteLength);if(Array.isArray(v))return Uint8Array.from(v);return new Uint8Array(0)};
const uniq=(items,key)=>{const seen=new Set();return arr(items).filter(x=>{const k=key(x);if(!k||seen.has(k))return false;seen.add(k);return true})};

function fileUrls(resourceId,fileId){const base=`/api/hub-resources/${encodeURIComponent(resourceId)}/files/${encodeURIComponent(fileId)}`;return{attachment_url:base,view_url:`${base}?view=1`}}

export async function listHubResourcesPublic(env){
  try{
    const res=await env.DB.prepare(`SELECT r.* FROM hub_resources r WHERE r.status='published' ORDER BY r.updated_at DESC`).all();
    const fileRes=await env.DB.prepare(`SELECT f.id,f.resource_id,f.name,f.mime,f.size,f.is_primary,f.external_url,f.created_at FROM hub_resource_files f INNER JOIN hub_resources r ON r.id=f.resource_id WHERE r.status='published' ORDER BY f.is_primary DESC,f.created_at ASC`).all();
    const byResource=new Map();
    for(const f of fileRes.results||[]){
      const mime=inferMime(f.name,f.mime),urls=fileUrls(f.resource_id,f.id),obj={id:f.id,name:f.name,mime,size:Number(f.size||0),primary:Boolean(f.is_primary),explicit_extra:isExtra(f.name),external_url:clean(f.external_url),attachment_url:urls.attachment_url,view_url:clean(f.external_url)||urls.view_url,download_url:urls.attachment_url,created_at:f.created_at||''};
      if(!byResource.has(f.resource_id))byResource.set(f.resource_id,[]);byResource.get(f.resource_id).push(obj);
    }
    const resources=(res.results||[]).map(r=>{
      const rawFiles=byResource.get(r.id)||[],rawMedia=arr(parseJson(r.media,[])).filter(Boolean),images=rawFiles.filter(f=>isImage(f.name,f.mime)),explicitExtras=images.filter(f=>f.explicit_extra),normalImages=images.filter(f=>!f.explicit_extra),storedCover=normalImages.find(f=>f.primary)||normalImages[0]||null,mediaCover=rawMedia.find(m=>m?.cover&&mediaUrl(m))||rawMedia.find(m=>mediaUrl(m))||null,mediaCoverUrl=mediaUrl(mediaCover),durableMedia=/^data:image\//i.test(mediaCoverUrl),coverUrl=durableMedia?mediaCoverUrl:(storedCover?.view_url||mediaCoverUrl||explicitExtras[0]?.view_url||'');
      const legacyExtraIds=new Set();
      if(!explicitExtras.length){for(const f of normalImages){if(!storedCover||f.id!==storedCover.id)legacyExtraIds.add(f.id)}}
      let files=rawFiles.map(f=>{const extra=f.explicit_extra||legacyExtraIds.has(f.id);return{...f,extra,legacy_extra:legacyExtraIds.has(f.id),download_url:extra&&isImage(f.name,f.mime)?f.view_url:f.attachment_url}});
      const represented=new Set(files.filter(f=>f.extra).map(f=>clean(f.view_url||f.download_url)));
      const extraMedia=[];
      for(let i=0;i<rawMedia.length;i++){
        const u=mediaUrl(rawMedia[i]);if(!u||u===coverUrl||represented.has(u))continue;
        if(!/^data:image\//i.test(u)&&!/^https?:\/\//i.test(u)&&!u.startsWith('/'))continue;
        represented.add(u);extraMedia.push({id:`media-${i}`,name:`__extra__media-${i+1}.jpg`,mime:'image/jpeg',size:0,primary:false,extra:true,legacy_extra:true,external_url:u,attachment_url:u,view_url:u,download_url:u,source:'legacy-media'});
      }
      files=[...files,...extraMedia];
      const restMedia=rawMedia.filter(m=>{const u=mediaUrl(m);return u&&u!==coverUrl}).map(m=>({...m,cover:false}));
      const media=coverUrl?[{url:coverUrl,cover:true,source:storedCover?'stored-file':'stored-media'},...restMedia]:rawMedia;
      const extras=files.filter(f=>f.extra&&isImage(f.name,f.mime));
      return{id:r.id,source_url:r.source_url,type:r.type,title:r.title,creator:{name:r.creator_name,link:r.creator_link},description_short:r.description_short,description_full:r.description_full,additional_info:r.additional_info||'',models:parseJson(r.models),settings:normalizeSettings(parseJson(r.settings)),tags:arr(parseJson(r.tags)).filter(x=>clean(x).toLowerCase()!=='magic'),media,cover_url:coverUrl,primary_file_id:rawFiles.find(f=>f.primary&&!f.explicit_extra)?.id||null,file_count:files.filter(f=>!f.extra).length,extra_count:extras.length,extra_images:extras,files,updated_at:r.updated_at};
    });
    return json({ok:true,resources,count:resources.length,media_compat:2});
  }catch(e){console.error('listHubResourcesPublic failed',e);return json({ok:false,error:'HUB_RESOURCE_LIST_FAILED',detail:String(e?.message||e)},500)}
}

export async function downloadHubFilePublic(request,env,resourceId,fileId){
  try{
    const row=await env.DB.prepare(`SELECT f.name,f.mime,f.size,f.data,f.external_url FROM hub_resource_files f INNER JOIN hub_resources r ON r.id=f.resource_id WHERE f.id=? AND f.resource_id=? AND r.status='published' LIMIT 1`).bind(fileId,resourceId).first();
    if(!row)return json({ok:false,error:'FILE_NOT_FOUND'},404);
    if(row.external_url)return Response.redirect(row.external_url,302);
    let body;
    if(row.data!=null){body=toBytes(row.data);if(!body.byteLength&&Number(row.size||0)>0)return json({ok:false,error:'FILE_DATA_INVALID'},500)}else{
      const chunks=await env.DB.prepare('SELECT data FROM hub_resource_file_chunks WHERE file_id=? ORDER BY chunk_index ASC').bind(fileId).all();
      if(!(chunks.results||[]).length)return json({ok:false,error:'FILE_DATA_MISSING'},404);
      const parts=(chunks.results||[]).map(x=>toBytes(x.data)),total=parts.reduce((n,p)=>n+p.byteLength,0),joined=new Uint8Array(total);let offset=0;for(const p of parts){joined.set(p,offset);offset+=p.byteLength}body=joined;
    }
    const mime=inferMime(row.name,row.mime),url=new URL(request.url),view=url.searchParams.get('view')==='1',inline=view&&isImage(row.name,mime),headers=new Headers({'content-type':mime,'cache-control':'public, max-age=86400','content-length':String(body.byteLength),'x-content-type-options':'nosniff'});
    if(inline)headers.set('content-disposition',`inline; filename*=UTF-8''${encodeURIComponent(clean(row.name)||'image')}`);else headers.set('content-disposition',`attachment; filename*=UTF-8''${encodeURIComponent(clean(row.name)||'download')}`);
    return new Response(body,{status:200,headers});
  }catch(e){console.error('downloadHubFilePublic failed',e);return json({ok:false,error:'HUB_FILE_READ_FAILED',detail:String(e?.message||e)},500)}
}

export async function hubMediaAudit(env){
  try{
    const response=await listHubResourcesPublic(env),data=await response.clone().json();if(!response.ok||!data.ok)return response;
    return json({ok:true,count:data.resources.length,resources:data.resources.map(r=>({id:r.id,title:r.title,cover:Boolean(r.cover_url),cover_kind:String(r.cover_url||'').startsWith('data:image/')?'embedded':String(r.cover_url||'').includes('?view=1')?'stored-file':r.cover_url?'remote':'missing',media_count:arr(r.media).length,file_count:arr(r.files).filter(f=>!f.extra).length,image_files:arr(r.files).filter(f=>isImage(f.name,f.mime)).length,extras:arr(r.files).filter(f=>f.extra&&isImage(f.name,f.mime)).length}))});
  }catch(e){return json({ok:false,error:'HUB_MEDIA_AUDIT_FAILED',detail:String(e?.message||e)},500)}
}
