import app from './cloudflare-entry.js';
import { handleAdminTelegramFixed } from './telegram-admin-fixed.js';
import { serveTelegramDraftMedia } from './telegram-media.js';

const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/telegram/admin') return handleAdminTelegramFixed(request, env);
    const mediaMatch=url.pathname.match(/^\/api\/hub-telegram-media\/([^/]+)\/(\d+)$/);
    if(mediaMatch)return serveTelegramDraftMedia(request,env,decodeURIComponent(mediaMatch[1]),mediaMatch[2]);
    if(url.pathname==='/api/debug/datacat')return json({ok:false,error:'NOT_FOUND'},404);
    if(url.pathname==='/api/import'||url.pathname==='/api/import/status')return json({ok:false,error:'ADMIN_IMPORT_ONLY'},403);
    return app.fetch(request, env, ctx);
  }
};
