import sourceTruth from './source-truth.js';
import { handleCloudflareRoute, transformAdminHtmlResponse } from './cloudflare-entry.js';
import { handleUniverseCurationRoute, transformUniversePublicResponse } from './universe-curation.js';
import { handleAdminTelegramRoute } from './telegram-admin-router.js';
import { handlePublicTelegramFull } from './telegram-public-bot.js';
import { serveTelegramDraftMedia } from './telegram-media.js';
import { listHubResourcesPublic, listHubResourcesSummaryPublic, getHubResourcePublic, getHubEmbeddedMediaPublic, downloadHubFilePublic, hubMediaAudit } from './hub-public-media.js';
import { hubStorageStatusSafe, migrateHubFilesToR2Safe } from './hub-r2-migration.js';
import { deleteLegacyMediaExtra } from './hub-admin-media.js';
import { guardAdminApi } from './admin-auth.js';
import { d1SchemaStatus } from './d1-schema-status.js';
import { repairTelegramMedia } from './hub-resources.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const BUILD_INFO={build:'hub-telegram-media-v1',deployed_from:'main'};
const CONTENT_SECURITY_POLICY=["default-src 'self'","base-uri 'self'","object-src 'none'","frame-ancestors 'none'","form-action 'self'","img-src 'self' https: data: blob:","media-src 'self' https: blob:","style-src 'self' 'unsafe-inline'","script-src 'self' 'unsafe-inline'","connect-src 'self'","font-src 'self' data:"].join('; ');
function withSecurityHeaders(response){
  const headers=new Headers(response.headers);
  headers.set('content-security-policy',CONTENT_SECURITY_POLICY);
  headers.set('cross-origin-opener-policy','same-origin');
  headers.set('permissions-policy','camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  headers.set('referrer-policy','strict-origin-when-cross-origin');
  headers.set('x-content-type-options','nosniff');
  headers.set('x-frame-options','DENY');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
function rewriteRequestPath(request,pathname){const url=new URL(request.url);url.pathname=pathname;return new Request(url.toString(),request)}
async function forwardAdminImport(request,env,ctx,pathname){
  const response=await sourceTruth.fetch(rewriteRequestPath(request,pathname),env,ctx);
  if(!response.headers.get('content-type')?.includes('application/json'))return response;
  try{
    const data=await response.clone().json();
    if(typeof data?.statusUrl!=='string'||!data.statusUrl.includes('/api/import/status'))return response;
    data.statusUrl=data.statusUrl.replace('/api/import/status','/api/admin/import/status');
    const headers=new Headers(response.headers);headers.delete('content-length');
    return new Response(JSON.stringify(data),{status:response.status,statusText:response.statusText,headers});
  }catch{return response}
}
async function routeRequest(request,env,ctx){
  const url=new URL(request.url),blocked=await guardAdminApi(request,env,url);if(blocked)return blocked;
  if(url.pathname==='/telegram/admin')return handleAdminTelegramRoute(request,env);
  if(url.pathname==='/telegram/public')return handlePublicTelegramFull(request,env);
  const mediaMatch=url.pathname.match(/^\/api\/admin\/hub-telegram-media\/([^/]+)\/(\d+)$/);
  if(mediaMatch)return serveTelegramDraftMedia(request,env,decodeURIComponent(mediaMatch[1]),mediaMatch[2]);
  if(url.pathname==='/api/build-info'){if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return json({ok:true,...BUILD_INFO})}
  if(url.pathname==='/api/hub-resources'){if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return url.searchParams.get('summary')==='1'?listHubResourcesSummaryPublic(env):listHubResourcesPublic(env)}
  const hubDetailMatch=url.pathname.match(/^\/api\/hub-resources\/([^/]+)$/);
  if(hubDetailMatch){if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return getHubResourcePublic(env,decodeURIComponent(hubDetailMatch[1]))}
  const hubMediaMatch=url.pathname.match(/^\/api\/hub-resources\/([^/]+)\/media\/(\d+)$/);
  if(hubMediaMatch){if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return getHubEmbeddedMediaPublic(env,decodeURIComponent(hubMediaMatch[1]),Number(hubMediaMatch[2]))}
  const hubFileMatch=url.pathname.match(/^\/api\/hub-resources\/([^/]+)\/files\/([^/]+)$/);
  if(hubFileMatch){if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return downloadHubFilePublic(request,env,decodeURIComponent(hubFileMatch[1]),decodeURIComponent(hubFileMatch[2]))}
  const legacyExtraDelete=url.pathname.match(/^\/api\/admin\/hub-resource\/([^/]+)\/files\/(media-\d+)$/);
  if(legacyExtraDelete&&request.method==='DELETE'){
    const response=await deleteLegacyMediaExtra(env,decodeURIComponent(legacyExtraDelete[1]),decodeURIComponent(legacyExtraDelete[2]));
    if(response)return response;
  }
  if(url.pathname==='/api/admin/import'){if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return forwardAdminImport(request,env,ctx,'/api/import')}
  if(url.pathname==='/api/admin/import/status'){if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return forwardAdminImport(request,env,ctx,'/api/import/status')}
  if(url.pathname==='/api/admin/schema-status'){if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return d1SchemaStatus(env)}
  if(url.pathname==='/api/admin/hub-media-audit'){if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return hubMediaAudit(env)}
  if(url.pathname==='/api/admin/hub-storage'){
    if(request.method==='GET')return hubStorageStatusSafe(env);
    if(request.method==='POST')return migrateHubFilesToR2Safe(request,env);
    return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  }
  if(url.pathname==='/api/admin/hub-media-repair'){if(request.method!=='GET'&&request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return repairTelegramMedia(request,env)}
  if(url.pathname==='/api/debug/datacat')return json({ok:false,error:'NOT_FOUND'},404);
  if(url.pathname==='/api/import'||url.pathname==='/api/import/status')return json({ok:false,error:'ADMIN_IMPORT_ONLY'},403);
  const cloudflareResponse=await handleCloudflareRoute(request,env);if(cloudflareResponse)return cloudflareResponse;
  const curationResponse=await handleUniverseCurationRoute(request,env);if(curationResponse)return curationResponse;
  let response=await sourceTruth.fetch(request,env,ctx);response=await transformUniversePublicResponse(request,response,env);return transformAdminHtmlResponse(request,response);
}
export default {async fetch(request,env,ctx){return withSecurityHeaders(await routeRequest(request,env,ctx))}};
