import app from './cloudflare-entry.js';
import { handleAdminTelegramFixed } from './telegram-admin-fixed.js';
import { serveTelegramDraftMedia } from './telegram-media.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/telegram/admin') return handleAdminTelegramFixed(request, env);
    const mediaMatch=url.pathname.match(/^\/api\/hub-telegram-media\/([^/]+)\/(\d+)$/);
    if(mediaMatch)return serveTelegramDraftMedia(request,env,decodeURIComponent(mediaMatch[1]),mediaMatch[2]);
    return app.fetch(request, env, ctx);
  }
};
