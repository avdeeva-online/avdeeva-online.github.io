import app from './cloudflare-entry.js';
import { handleAdminTelegram } from './telegram-admin-bot.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/telegram/admin') return handleAdminTelegram(request, env);
    return app.fetch(request, env, ctx);
  }
};
