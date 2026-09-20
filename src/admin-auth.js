import { createRemoteJWKSet, jwtVerify } from 'jose';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const remoteKeySets=new Map();
const clean=v=>String(v||'').trim();
function teamDomain(env){return clean(env.TEAM_DOMAIN).replace(/\/$/,'')}
function remoteKeys(domain){if(!remoteKeySets.has(domain))remoteKeySets.set(domain,createRemoteJWKSet(new URL(`${domain}/cdn-cgi/access/certs`)));return remoteKeySets.get(domain)}

export async function verifyCloudflareAccess(request,env,{jwks}={}){
  const domain=teamDomain(env),audience=clean(env.POLICY_AUD),token=clean(request.headers.get('cf-access-jwt-assertion'));
  if(!domain||!audience)return{ok:false,status:503,error:'CF_ACCESS_AUTH_NOT_CONFIGURED'};
  if(!token)return{ok:false,status:401,error:'CF_ACCESS_AUTH_REQUIRED'};
  try{
    const {payload}=await jwtVerify(token,jwks||remoteKeys(domain),{issuer:domain,audience,algorithms:['RS256']});
    return{ok:true,payload};
  }catch{return{ok:false,status:403,error:'CF_ACCESS_AUTH_INVALID'}}
}

export async function adminRequestBlocked(request,env,url=new URL(request.url),verification={}){
  const site=String(request.headers.get('sec-fetch-site')||'').toLowerCase();
  if(site&&site!=='same-origin')return json({ok:false,error:'ADMIN_CROSS_SITE_BLOCKED'},403);
  const origin=request.headers.get('origin');
  if(origin){try{if(new URL(origin).origin!==url.origin)return json({ok:false,error:'ADMIN_ORIGIN_BLOCKED'},403)}catch{return json({ok:false,error:'ADMIN_ORIGIN_INVALID'},403)}}
  const access=await verifyCloudflareAccess(request,env,verification);
  return access.ok?null:json({ok:false,error:access.error},access.status);
}

export async function guardAdminApi(request,env,url=new URL(request.url)){
  return url.pathname.startsWith('/api/admin/')?adminRequestBlocked(request,env,url):null;
}
