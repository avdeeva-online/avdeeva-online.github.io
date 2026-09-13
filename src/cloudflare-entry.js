import app from './universe-curation.js';
import { analyzeTelegramPost } from './hub-telegram.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/api/admin/hub-telegram-analyze'){
      if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
      return analyzeTelegramPost(request);
    }
    return app.fetch(request,env,ctx);
  }
};
