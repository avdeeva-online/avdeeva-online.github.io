import { analyzeTelegramPost } from './hub-telegram.js';
import { publishHubResource, deleteHubResourceFile, setHubResourcePrimary, deleteHubResource } from './hub-resources.js';
import { listAdminCharacters, updateAdminCharacter, deleteAdminCharacter } from './character-admin.js';
import { submitHubSuggestion, listHubSuggestions, updateHubSuggestion } from './hub-suggestions.js';
import { setupTelegramWebhooks, telegramWebhookStatus } from './telegram-webhooks.js';
import { telegramDraftsAdmin } from './telegram-drafts-admin.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
async function adminHealth(env){const one=async sql=>{try{return Number((await env.DB.prepare(sql).first())?.n||0)}catch{return null}};const [characters,resources,files,chunks,lorebooks,lorebookBlobs,orphanLorebooks,orphanBlobs,suggestions,drafts,publishSessions]=await Promise.all([one('SELECT COUNT(*) AS n FROM characters'),one('SELECT COUNT(*) AS n FROM hub_resources'),one('SELECT COUNT(*) AS n FROM hub_resource_files'),one('SELECT COUNT(*) AS n FROM hub_resource_file_chunks'),one('SELECT COUNT(*) AS n FROM lorebooks'),one('SELECT COUNT(*) AS n FROM lorebook_blobs'),one('SELECT COUNT(*) AS n FROM lorebooks WHERE id NOT IN (SELECT DISTINCT lorebook_id FROM character_lorebooks)'),one("SELECT COUNT(*) AS n FROM lorebook_blobs WHERE content_hash NOT IN (SELECT DISTINCT content_hash FROM lorebooks WHERE content_hash IS NOT NULL AND content_hash != '')"),one("SELECT COUNT(*) AS n FROM hub_suggestions WHERE status='new'"),one("SELECT COUNT(*) AS n FROM telegram_admin_drafts WHERE status='review'"),one('SELECT COUNT(*) AS n FROM hub_resource_publish_sessions')]);return json({ok:true,db:true,adminTokenConfigured:Boolean(String(env.ADMIN_ACCESS_TOKEN||'').trim()),counts:{characters,resources,files,chunks,lorebooks,lorebookBlobs,orphanLorebooks,orphanBlobs,suggestions,drafts,publishSessions},checkedAt:new Date().toISOString()})}
async function injectAdminBack(response,pathname=''){
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('text/html'))return response;
  let html=await response.text();
  if(!html.includes('data-admin-back-script'))html=html.replace(/<\/body>/i,'<script data-admin-back-script src="/admin/admin-back.js?v=20260916-nav6"></script></body>');
  if(pathname==='/admin/hub/'||pathname==='/admin/hub/index.html'){
    html=html.replace(/admin-edit\.js\?v=[^"']+/g,'admin-edit.js?v=20260917-1');
    if(!html.includes('data-source-media-remove'))html=html.replace(/<\/body>/i,'<script data-source-media-remove src="/admin/hub/source-media-remove.js?v=20260917-1"></script></body>');
    else html=html.replace(/source-media-remove\.js\?v=[^"']+/g,'source-media-remove.js?v=20260917-1');
    html=html.replace(/draft-bridge\.js\?v=[^"']+/g,'draft-bridge.js?v=20260917-1');
  }
  const headers=new Headers(response.headers);headers.set('cache-control','no-store');headers.delete('content-length');return new Response(html,{status:response.status,statusText:response.statusText,headers})
}

export async function handleCloudflareRoute(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/admin/telegram/setup')return setupTelegramWebhooks(request,env);
  if(url.pathname==='/api/admin/telegram/status')return telegramWebhookStatus(request,env);
  if(url.pathname==='/api/admin/telegram-drafts')return telegramDraftsAdmin(request,env);
  const telegramDraftMatch=url.pathname.match(/^\/api\/admin\/telegram-drafts\/([^/]+)(?:\/(publish))?$/);if(telegramDraftMatch)return telegramDraftsAdmin(request,env,decodeURIComponent(telegramDraftMatch[1]),telegramDraftMatch[2]||'');
  if(url.pathname==='/api/hub-suggestions')return submitHubSuggestion(request,env);
  if(url.pathname==='/api/admin/hub-suggestions')return listHubSuggestions(request,env);
  const suggestionMatch=url.pathname.match(/^\/api\/admin\/hub-suggestions\/(\d+)$/);if(suggestionMatch)return updateHubSuggestion(request,env,suggestionMatch[1]);
  if(url.pathname==='/api/admin/health'){if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return adminHealth(env)}
  if(url.pathname==='/api/admin/characters'){if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return listAdminCharacters(request,env)}
  const adminCharacterMatch=url.pathname.match(/^\/api\/admin\/characters\/([0-9a-f-]{36})$/i);if(adminCharacterMatch){const uuid=adminCharacterMatch[1].toLowerCase();if(request.method==='PATCH'||request.method==='POST')return updateAdminCharacter(request,env,uuid);if(request.method==='DELETE')return deleteAdminCharacter(request,env,uuid);return json({ok:false,error:'METHOD_NOT_ALLOWED'},405)}
  if(url.pathname==='/api/admin/hub-telegram-analyze'){if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return analyzeTelegramPost(request)}
  if(url.pathname==='/api/admin/hub-resource'){if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return publishHubResource(request,env)}
  const adminResourceMatch=url.pathname.match(/^\/api\/admin\/hub-resource\/([^/]+)$/);if(adminResourceMatch){const resourceId=decodeURIComponent(adminResourceMatch[1]);if(request.method==='DELETE')return deleteHubResource(env,resourceId);return json({ok:false,error:'METHOD_NOT_ALLOWED'},405)}
  const primaryMatch=url.pathname.match(/^\/api\/admin\/hub-resource\/([^/]+)\/files\/([^/]+)\/primary$/);if(primaryMatch){if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return setHubResourcePrimary(env,decodeURIComponent(primaryMatch[1]),decodeURIComponent(primaryMatch[2]))}
  const adminFileMatch=url.pathname.match(/^\/api\/admin\/hub-resource\/([^/]+)\/files\/([^/]+)$/);if(adminFileMatch){if(request.method!=='DELETE')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);return deleteHubResourceFile(env,decodeURIComponent(adminFileMatch[1]),decodeURIComponent(adminFileMatch[2]))}
  return null;
}

export async function transformAdminHtmlResponse(request,response){
  const url=new URL(request.url);
  if(request.method==='GET'&&url.pathname.startsWith('/admin/')&&url.pathname!=='/admin/')return injectAdminBack(response,url.pathname);
  return response;
}
