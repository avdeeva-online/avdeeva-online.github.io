import app from './universe-curation.js';
import { analyzeTelegramPost } from './hub-telegram.js';
import { publishHubResource, listHubResources, downloadHubFile, injectHubResources } from './hub-resources.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/api/admin/hub-telegram-analyze'){
      if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
      return analyzeTelegramPost(request);
    }
    if(url.pathname==='/api/admin/hub-resource'){
      if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
      return publishHubResource(request,env);
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
