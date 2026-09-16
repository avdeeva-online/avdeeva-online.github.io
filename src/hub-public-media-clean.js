import { listHubResourcesPublic, downloadHubFilePublic } from './hub-public-media.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const arr=v=>Array.isArray(v)?v:[];
const clean=v=>String(v??'').trim();
const isImage=f=>/^image\//i.test(clean(f?.mime))||/\.(png|jpe?g|webp|gif|svg)$/i.test(clean(f?.name));

// Source-post images and EXTRAS are different concepts.
// Older compatibility code exposed every non-cover source image as a virtual EXTRA,
// and Telegram publishing also stored auto-generated `telegram-extra-*` files.
// Keep source media available in resource.media for cover selection/editor preview,
// but never expose those automatic source images as EXTRAS.
function isAutoSourceExtra(f){
  const name=clean(f?.name).replace(/^__extra__/,'');
  return f?.source==='legacy-media'||/^media-\d+$/.test(clean(f?.id))||/^telegram-extra-\d+\./i.test(name);
}

function cleanResource(r){
  const files=arr(r?.files).filter(f=>!isAutoSourceExtra(f));
  const extras=files.filter(f=>Boolean(f?.extra)&&isImage(f));
  return {
    ...r,
    files,
    extra_images:extras,
    extra_count:extras.length,
    file_count:files.filter(f=>!f?.extra).length
  };
}

export async function listHubResourcesClean(env){
  const response=await listHubResourcesPublic(env);
  let data={};
  try{data=await response.clone().json()}catch{return response}
  if(!response.ok||!data?.ok||!Array.isArray(data.resources))return response;
  const resources=data.resources.map(cleanResource);
  return json({...data,resources,count:resources.length,media_compat:3});
}

export { downloadHubFilePublic };

export async function hubMediaAuditClean(env){
  try{
    const response=await listHubResourcesClean(env),data=await response.clone().json();
    if(!response.ok||!data.ok)return response;
    return json({ok:true,count:data.resources.length,resources:data.resources.map(r=>({
      id:r.id,
      title:r.title,
      cover:Boolean(r.cover_url),
      media_count:arr(r.media).length,
      file_count:arr(r.files).filter(f=>!f?.extra).length,
      extras:arr(r.extra_images).length,
      source_media_not_extras:Math.max(0,arr(r.media).length-(r.cover_url?1:0))
    }))});
  }catch(e){return json({ok:false,error:'HUB_MEDIA_AUDIT_FAILED',detail:String(e?.message||e)},500)}
}
