import app from './universe-curation.js';
import { analyzeTelegramPost } from './hub-telegram.js';
import { publishHubResource, listHubResources, downloadHubFile, deleteHubResourceFile, setHubResourcePrimary, deleteHubResource, injectHubResources } from './hub-resources.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/api/admin/hub-telegram-analyze'){
      if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
      const response=await analyzeTelegramPost(request);
      try{
        const data=await response.json();
        if(Array.isArray(data?.draft?.settings))data.draft.settings=data.draft.settings.filter(x=>x!=='school-university');
        return json(data,response.status);
      }catch{return response}
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
      const response=await app.fetch(request,env,ctx);
      return injectHubResources(response,env);
    }
    return app.fetch(request,env,ctx);
  }
};
