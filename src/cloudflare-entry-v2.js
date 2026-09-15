import app from './cloudflare-entry.js';
import { handleAdminTelegramIngest } from './telegram-admin-ingest.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/telegram/admin') return handleAdminTelegramIngest(request, env);
    return app.fetch(request, env, ctx);
  }
};
