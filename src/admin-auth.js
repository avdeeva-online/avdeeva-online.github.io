const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

export function adminRequestBlocked(request,env,url=new URL(request.url)){
  const site=String(request.headers.get('sec-fetch-site')||'').toLowerCase();
  if(site&&site!=='same-origin')return json({ok:false,error:'ADMIN_CROSS_SITE_BLOCKED'},403);
  const origin=request.headers.get('origin');
  if(origin){try{if(new URL(origin).origin!==url.origin)return json({ok:false,error:'ADMIN_ORIGIN_BLOCKED'},403)}catch{return json({ok:false,error:'ADMIN_ORIGIN_INVALID'},403)}}
  const configured=String(env.ADMIN_ACCESS_TOKEN||'').trim();
  if(!configured)return json({ok:false,error:'ADMIN_AUTH_NOT_CONFIGURED'},503);
  const direct=String(request.headers.get('x-archive-admin-token')||'').trim(),auth=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();if(direct!==configured&&auth!==configured)return json({ok:false,error:'ADMIN_AUTH_REQUIRED'},401);
  return null;
}

export function guardAdminApi(request,env,url=new URL(request.url)){
  return url.pathname.startsWith('/api/admin/')?adminRequestBlocked(request,env,url):null;
}
