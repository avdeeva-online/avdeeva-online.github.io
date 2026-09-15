const clean=v=>String(v??'').trim();
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

async function tg(token,method,payload={}){
  const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json().catch(()=>({ok:false,description:`HTTP_${r.status}`}));
  if(!r.ok||!d.ok)throw new Error(d.description||`TELEGRAM_${method}_FAILED`);
  return d.result;
}

export async function serveTelegramDraftMedia(request,env,draftId,indexRaw){
  if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const token=clean(env.Node00admin);if(!token)return json({ok:false,error:'ADMIN_BOT_TOKEN_MISSING'},503);
  const index=Number(indexRaw);if(!Number.isInteger(index)||index<0)return json({ok:false,error:'INVALID_MEDIA_INDEX'},400);
  const row=await env.DB.prepare('SELECT payload FROM telegram_admin_drafts WHERE id=? LIMIT 1').bind(draftId).first();
  if(!row?.payload)return json({ok:false,error:'DRAFT_NOT_FOUND'},404);
  let payload={};try{payload=JSON.parse(row.payload||'{}')}catch{}
  const media=Array.isArray(payload.media)?payload.media:[],item=media[index];
  if(!item)return json({ok:false,error:'MEDIA_NOT_FOUND'},404);
  if(item.url&&/^https?:\/\//i.test(item.url))return Response.redirect(item.url,302);
  const fileId=clean(item.telegram_file_id);if(!fileId)return json({ok:false,error:'TELEGRAM_MEDIA_ID_MISSING'},404);
  try{
    const info=await tg(token,'getFile',{file_id:fileId});
    if(!info?.file_path)return json({ok:false,error:'TELEGRAM_FILE_PATH_MISSING'},404);
    const r=await fetch(`https://api.telegram.org/file/bot${token}/${info.file_path}`);
    if(!r.ok)return json({ok:false,error:'TELEGRAM_MEDIA_DOWNLOAD_FAILED',status:r.status},502);
    const h=new Headers();h.set('content-type',r.headers.get('content-type')||'image/jpeg');h.set('cache-control','private, max-age=300');
    return new Response(r.body,{status:200,headers:h});
  }catch(e){return json({ok:false,error:'TELEGRAM_MEDIA_FAILED',detail:String(e?.message||e)},502)}
}
