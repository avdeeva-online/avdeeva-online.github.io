import app from './cloudflare-entry.js';
import { handleAdminTelegramRoute } from './telegram-admin-router.js';
import { handlePublicTelegramFull } from './telegram-public-bot.js';
import { serveTelegramDraftMedia } from './telegram-media.js';
import { listHubResourcesPublic, listHubResourcesSummaryPublic, getHubResourcePublic, downloadHubFilePublic, hubMediaAudit } from './hub-public-media.js';
import { hubStorageStatusSafe, migrateHubFilesToR2Safe } from './hub-r2-migration.js';
import { deleteLegacyMediaExtra } from './hub-admin-media.js';
import { guardAdminApi } from './admin-auth.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export default {async fetch(request,env,ctx){
  const url=new URL(request.url),blocked=guardAdminApi(request,env,url);if(blocked)return blocked;
  if(url.pathname==='/telegram/admin')return handleAdminTelegramRoute(request,env);
  if(url.pathname==='/telegram/public')return handlePublicTelegramFull(request,env);
  const mediaMatch=url.pathname.match(/^\/api\/admin\/hub-telegram-media\/([^/]+)\/(\d+)$/);
  if(mediaMatch)return serveTelegramDraftMedia(request,env,decodeURIComponent(mediaMatch[1]),mediaMatch[2]);
  if(url.pathname==='/api/hub-resources'){if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return url.searchParams.get('summary')==='1'?listHubResourcesSummaryPublic(env):listHubResourcesPublic(env)}
  const hubDetailMatch=url.pathname.match(/^\/api\/hub-resources\/([^/]+)$/);
  if(hubDetailMatch){if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return getHubResourcePublic(env,decodeURIComponent(hubDetailMatch[1]))}
  const hubFileMatch=url.pathname.match(/^\/api\/hub-resources\/([^/]+)\/files\/([^/]+)$/);
  if(hubFileMatch){if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return downloadHubFilePublic(request,env,decodeURIComponent(hubFileMatch[1]),decodeURIComponent(hubFileMatch[2]))}
  const legacyExtraDelete=url.pathname.match(/^\/api\/admin\/hub-resource\/([^/]+)\/files\/(media-\d+)$/);
  if(legacyExtraDelete&&request.method==='DELETE'){
    const response=await deleteLegacyMediaExtra(env,decodeURIComponent(legacyExtraDelete[1]),decodeURIComponent(legacyExtraDelete[2]));
    if(response)return response;
  }
  if(url.pathname==='/api/admin/hub-media-audit'){if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return hubMediaAudit(env)}
  if(url.pathname==='/api/admin/hub-storage'){
    if(request.method==='GET')return hubStorageStatusSafe(env);
    if(request.method==='POST')return migrateHubFilesToR2Safe(request,env);
    return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  }
  if(url.pathname==='/api/debug/datacat')return json({ok:false,error:'NOT_FOUND'},404);
  if(url.pathname==='/api/import'||url.pathname==='/api/import/status')return json({ok:false,error:'ADMIN_IMPORT_ONLY'},403);
  return app.fetch(request,env,ctx);
}};
