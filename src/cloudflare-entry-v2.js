import app from './cloudflare-entry.js';
import { handleAdminTelegramFixed } from './telegram-admin-fixed.js';
import { handlePublicTelegramFull } from './telegram-public-bot.js';
import { serveTelegramDraftMedia } from './telegram-media.js';
import { listHubResourcesClean, downloadHubFilePublic, hubMediaAuditClean } from './hub-public-media-clean.js';
import { deleteLegacyMediaExtra } from './hub-admin-media.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
function adminRequestBlocked(request,env,url){
  const site=String(request.headers.get('sec-fetch-site')||'').toLowerCase();
  if(site&&site!=='same-origin')return json({ok:false,error:'ADMIN_CROSS_SITE_BLOCKED'},403);
  const origin=request.headers.get('origin');
  if(origin){try{if(new URL(origin).origin!==url.origin)return json({ok:false,error:'ADMIN_ORIGIN_BLOCKED'},403)}catch{return json({ok:false,error:'ADMIN_ORIGIN_INVALID'},403)}}
  const configured=String(env.ADMIN_ACCESS_TOKEN||'').trim();
  if(configured){const direct=String(request.headers.get('x-archive-admin-token')||'').trim(),auth=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();if(direct!==configured&&auth!==configured)return json({ok:false,error:'ADMIN_AUTH_REQUIRED'},401)}
  return null;
}
export default {async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(url.pathname==='/telegram/admin')return handleAdminTelegramFixed(request,env);
  if(url.pathname==='/telegram/public')return handlePublicTelegramFull(request,env);
  const mediaMatch=url.pathname.match(/^\/api\/admin\/hub-telegram-media\/([^/]+)\/(\d+)$/);
  if(mediaMatch){const blocked=adminRequestBlocked(request,env,url);if(blocked)return blocked;return serveTelegramDraftMedia(request,env,decodeURIComponent(mediaMatch[1]),mediaMatch[2])}
  if(url.pathname==='/api/hub-resources'){if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return listHubResourcesClean(env)}
  const hubFileMatch=url.pathname.match(/^\/api\/hub-resources\/([^/]+)\/files\/([^/]+)$/);
  if(hubFileMatch){if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return downloadHubFilePublic(request,env,decodeURIComponent(hubFileMatch[1]),decodeURIComponent(hubFileMatch[2]))}
  const legacyExtraDelete=url.pathname.match(/^\/api\/admin\/hub-resource\/([^/]+)\/files\/(media-\d+)$/);
  if(legacyExtraDelete&&request.method==='DELETE'){
    const blocked=adminRequestBlocked(request,env,url);if(blocked)return blocked;
    const response=await deleteLegacyMediaExtra(env,decodeURIComponent(legacyExtraDelete[1]),decodeURIComponent(legacyExtraDelete[2]));
    if(response)return response;
  }
  if(url.pathname==='/api/admin/hub-media-audit'){const blocked=adminRequestBlocked(request,env,url);if(blocked)return blocked;if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return hubMediaAuditClean(env)}
  if(url.pathname==='/api/debug/datacat')return json({ok:false,error:'NOT_FOUND'},404);
  if(url.pathname==='/api/import'||url.pathname==='/api/import/status')return json({ok:false,error:'ADMIN_IMPORT_ONLY'},403);
  return app.fetch(request,env,ctx);
}};
