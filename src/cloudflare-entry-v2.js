import app from './cloudflare-entry.js';
import { handleAdminTelegramFixed } from './telegram-admin-fixed.js';
import { serveTelegramDraftMedia } from './telegram-media.js';

async function persistTelegramMediaUrls(env,draftId){
  try{
    const row=await env.DB.prepare('SELECT payload FROM telegram_admin_drafts WHERE id=? LIMIT 1').bind(draftId).first();
    if(!row?.payload)return;
    const a=JSON.parse(row.payload||'{}'),media=Array.isArray(a.media)?a.media:[];
    let changed=false;
    a.media=media.map((m,i)=>{
      if(m&&m.telegram_file_id&&!m.url){changed=true;return{...m,url:`/api/hub-telegram-media/${encodeURIComponent(draftId)}/${i}`}}
      return m;
    });
    if(changed)await env.DB.prepare('UPDATE telegram_admin_drafts SET payload=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(JSON.stringify(a),draftId).run();
  }catch(e){console.warn('telegram media url persistence failed',e)}
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/telegram/admin') return handleAdminTelegramFixed(request, env);
    const mediaMatch=url.pathname.match(/^\/api\/hub-telegram-media\/([^/]+)\/(\d+)$/);
    if(mediaMatch)return serveTelegramDraftMedia(request,env,decodeURIComponent(mediaMatch[1]),mediaMatch[2]);
    const publishMatch=url.pathname.match(/^\/api\/admin\/telegram-drafts\/([^/]+)\/publish$/);
    if(publishMatch&&request.method==='POST')await persistTelegramMediaUrls(env,decodeURIComponent(publishMatch[1]));
    return app.fetch(request, env, ctx);
  }
};
