import app from './cloudflare-entry.js';
import { handleAdminTelegramFixed } from './telegram-admin-fixed.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/telegram/admin') return handleAdminTelegramFixed(request, env);
    return app.fetch(request, env, ctx);
  }
};
