const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const clean=v=>String(v??'').trim();
const arr=v=>Array.isArray(v)?v:[];
const parseJson=v=>{try{const x=JSON.parse(v||'[]');return Array.isArray(x)?x:[]}catch{return[]}};
const mediaUrl=m=>clean(m?.url||m?.src);

export async function deleteLegacyMediaExtra(env,resourceId,fileId){
  const match=String(fileId||'').match(/^media-(\d+)$/);
  if(!match)return null;
  const index=Number(match[1]);
  if(!Number.isInteger(index)||index<0)return json({ok:false,error:'INVALID_MEDIA_ID'},400);
  const row=await env.DB.prepare('SELECT id,media FROM hub_resources WHERE id=? LIMIT 1').bind(resourceId).first();
  if(!row)return json({ok:false,error:'RESOURCE_NOT_FOUND'},404);
  const media=parseJson(row.media);
  if(index>=media.length)return json({ok:false,error:'MEDIA_NOT_FOUND'},404);
  const target=media[index];
  if(!mediaUrl(target))return json({ok:false,error:'MEDIA_NOT_FOUND'},404);
  media.splice(index,1);
  if(media.length&&!media.some(x=>x?.cover))media[0]={...media[0],cover:true};
  await env.DB.prepare('UPDATE hub_resources SET media=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(JSON.stringify(media),resourceId).run();
  return json({ok:true,deleted:true,kind:'legacy-media',remaining_media:media.length});
}
