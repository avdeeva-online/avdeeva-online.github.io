import app from './universe-curation.js';
import { analyzeTelegramPost } from './hub-telegram.js';
import { publishHubResource, listHubResources, downloadHubFile, deleteHubResourceFile, setHubResourcePrimary, deleteHubResource, injectHubResources } from './hub-resources.js';
import { listAdminCharacters, updateAdminCharacter, deleteAdminCharacter } from './character-admin.js';
import { submitHubSuggestion, listHubSuggestions, updateHubSuggestion } from './hub-suggestions.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
function adminGuard(request,env,url){
  if(!url.pathname.startsWith('/api/admin/'))return null;
  const site=String(request.headers.get('sec-fetch-site')||'').toLowerCase();
  if(site&&site!=='same-origin')return json({ok:false,error:'ADMIN_CROSS_SITE_BLOCKED'},403);
  const origin=request.headers.get('origin');
  if(origin){try{if(new URL(origin).origin!==url.origin)return json({ok:false,error:'ADMIN_ORIGIN_BLOCKED'},403)}catch{return json({ok:false,error:'ADMIN_ORIGIN_INVALID'},403)}}
  const configured=String(env.ADMIN_ACCESS_TOKEN||'').trim();
  if(configured){
    const direct=String(request.headers.get('x-archive-admin-token')||'').trim();
    const auth=String(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
    if(direct!==configured&&auth!==configured)return json({ok:false,error:'ADMIN_AUTH_REQUIRED'},401);
  }
  return null;
}
async function adminHealth(env){
  const one=async sql=>{try{return Number((await env.DB.prepare(sql).first())?.n||0)}catch{return null}};
  const [characters,resources,files,chunks,lorebooks,lorebookBlobs,orphanLorebooks,orphanBlobs,suggestions]=await Promise.all([
    one('SELECT COUNT(*) AS n FROM characters'),
    one('SELECT COUNT(*) AS n FROM hub_resources'),
    one('SELECT COUNT(*) AS n FROM hub_resource_files'),
    one('SELECT COUNT(*) AS n FROM hub_resource_file_chunks'),
    one('SELECT COUNT(*) AS n FROM lorebooks'),
    one('SELECT COUNT(*) AS n FROM lorebook_blobs'),
    one('SELECT COUNT(*) AS n FROM lorebooks WHERE id NOT IN (SELECT DISTINCT lorebook_id FROM character_lorebooks)'),
    one("SELECT COUNT(*) AS n FROM lorebook_blobs WHERE content_hash NOT IN (SELECT DISTINCT content_hash FROM lorebooks WHERE content_hash IS NOT NULL AND content_hash != '')"),
    one("SELECT COUNT(*) AS n FROM hub_suggestions WHERE status='new'")
  ]);
  return json({ok:true,db:true,adminTokenConfigured:Boolean(String(env.ADMIN_ACCESS_TOKEN||'').trim()),counts:{characters,resources,files,chunks,lorebooks,lorebookBlobs,orphanLorebooks,orphanBlobs,suggestions},checkedAt:new Date().toISOString()});
}
async function injectAdminBack(response){
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('text/html'))return response;
  let html=await response.text();
  if(!html.includes('data-admin-back-script'))html=html.replace(/<\/body>/i,'<script data-admin-back-script src="/admin/admin-back.js?v=20260913"></script></body>');
  const headers=new Headers(response.headers);
  headers.set('cache-control','no-store');
  headers.delete('content-length');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}
async function injectHubSuggest(response){
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(!type.includes('text/html'))return response;
  let html=await response.text();
  if(!html.includes('data-hub-suggest-script'))html=html.replace(/<\/body>/i,'<script data-hub-suggest-script src="/hub-suggest.js?v=20260913-1"></script></body>');
  const headers=new Headers(response.headers);headers.delete('content-length');
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    const blocked=adminGuard(request,env,url);if(blocked)return blocked;
    if(url.pathname==='/api/hub-suggestions')return submitHubSuggestion(request,env);
    if(url.pathname==='/api/admin/hub-suggestions')return listHubSuggestions(request,env);
    const suggestionMatch=url.pathname.match(/^\/api\/admin\/hub-suggestions\/(\d+)$/);
    if(suggestionMatch)return updateHubSuggestion(request,env,suggestionMatch[1]);
    if(url.pathname==='/api/admin/health'){
      if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
      return adminHealth(env);
    }
    if(url.pathname==='/api/admin/characters'){
      if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
      return listAdminCharacters(request,env);
    }
    const adminCharacterMatch=url.pathname.match(/^\/api\/admin\/characters\/([0-9a-f-]{36})$/i);
    if(adminCharacterMatch){
      const uuid=adminCharacterMatch[1].toLowerCase();
      if(request.method==='PATCH'||request.method==='POST')return updateAdminCharacter(request,env,uuid);
      if(request.method==='DELETE')return deleteAdminCharacter(request,env,uuid);
      return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
    }
    if(url.pathname==='/api/admin/hub-telegram-analyze'){
      if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
      return analyzeTelegramPost(request);
    }
    if(url.pathname==='/api/admin/hub-resource'){
      if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
      return publishHubResource(request,env);
    }
    const adminResourceMatch=url.pathname.match(/^\/api\/admin\/hub-resource\/([^/]+)$/);
    if(adminResourceMatch){
      const resourceId=decodeURIComponent(adminResourceMatch[1]);
      if(request.method==='DELETE')return deleteHubResource(env,resourceId);
      return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
    }
    const primaryMatch=url.pathname.match(/^\/api\/admin\/hub-resource\/([^/]+)\/files\/([^/]+)\/primary$/);
    if(primaryMatch){
      if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
      return setHubResourcePrimary(env,decodeURIComponent(primaryMatch[1]),decodeURIComponent(primaryMatch[2]));
    }
    const adminFileMatch=url.pathname.match(/^\/api\/admin\/hub-resource\/([^/]+)\/files\/([^/]+)$/);
    if(adminFileMatch){
      if(request.method!=='DELETE')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
      return deleteHubResourceFile(env,decodeURIComponent(adminFileMatch[1]),decodeURIComponent(adminFileMatch[2]));
    }
    if(url.pathname==='/api/hub-resources'){
      if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
      return listHubResources(env);
    }
    const fileMatch=url.pathname.match(/^\/api\/hub-resources\/([^/]+)\/files\/([^/]+)$/);
    if(fileMatch){
      if(request.method!=='GET')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
      return downloadHubFile(env,decodeURIComponent(fileMatch[1]),decodeURIComponent(fileMatch[2]));
    }
    if(request.method==='GET'&&(url.pathname==='/hub.html'||url.pathname==='/hub'||url.pathname==='/hub/')){
      let response=await app.fetch(request,env,ctx);
      response=await injectHubResources(response,env);
      return injectHubSuggest(response);
    }
    const response=await app.fetch(request,env,ctx);
    if(request.method==='GET'&&url.pathname.startsWith('/admin/')&&url.pathname!=='/admin/')return injectAdminBack(response);
    return response;
  }
};