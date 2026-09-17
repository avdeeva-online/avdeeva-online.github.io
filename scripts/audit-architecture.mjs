import fs from 'node:fs';

const errors=[];
const read=p=>fs.readFileSync(p,'utf8');
const exists=p=>fs.existsSync(p);
const fail=(ok,msg)=>{if(!ok)errors.push(msg)};

fail(exists('src/admin-auth.js'),'src/admin-auth.js: shared admin authorization module missing');
if(exists('src/admin-auth.js')){
  const auth=read('src/admin-auth.js');
  for(const marker of ['adminRequestBlocked','guardAdminApi','ADMIN_CROSS_SITE_BLOCKED','ADMIN_AUTH_REQUIRED'])fail(auth.includes(marker),`src/admin-auth.js: missing ${marker}`);
}

const edge=read('src/cloudflare-entry-v2.js');
const app=read('src/cloudflare-entry.js');
fail(edge.includes("from './admin-auth.js'"),'src/cloudflare-entry-v2.js: shared admin auth not imported');
fail(app.includes("from './admin-auth.js'"),'src/cloudflare-entry.js: shared admin auth not imported');
fail(edge.includes('guardAdminApi(request,env,url)'),'src/cloudflare-entry-v2.js: top-level admin API guard missing');
fail(app.includes('guardAdminApi(request,env,url)'),'src/cloudflare-entry.js: top-level admin API guard missing');
fail(!/adminRequestBlocked\s*\(request,env,url\)/.test(edge),'src/cloudflare-entry-v2.js: per-route admin guard returned; use guardAdminApi once before dispatch');
fail(!/function\s+adminRequestBlocked\b/.test(edge),'src/cloudflare-entry-v2.js: duplicate adminRequestBlocked implementation returned');
fail(!/function\s+adminGuard\b/.test(app),'src/cloudflare-entry.js: duplicate adminGuard implementation returned');

fail(exists('src/telegram-webhooks.js'),'src/telegram-webhooks.js: isolated webhook helper missing');
if(exists('src/telegram-webhooks.js')){
  const telegramWebhooks=read('src/telegram-webhooks.js');
  for(const marker of ['setupTelegramWebhooks','telegramWebhookStatus','setWebhook','getWebhookInfo'])fail(telegramWebhooks.includes(marker),`src/telegram-webhooks.js: missing ${marker}`);
}
fail(app.includes("from './telegram-webhooks.js'"),'src/cloudflare-entry.js: Telegram webhook helpers not isolated');
fail(!app.includes("from './telegram-bots.js'"),'src/cloudflare-entry.js: legacy telegram-bots.js dependency returned');

const entry=read('src/entry.js');
for(const marker of ['scanDatacatCreator','catalogCharacters','catalogLorebooks'])fail(!entry.includes(marker),`src/entry.js: shadowed legacy ${marker} returned`);
fail(!/page\s*<=\s*50/.test(entry),'src/entry.js: legacy 50-page scan returned');
fail(!entry.includes('url.pathname==="/api/characters"')&&!entry.includes("url.pathname==='/api/characters'"),'src/entry.js: shadowed character catalog route returned');
fail(!entry.includes('url.pathname==="/api/lorebooks"')&&!entry.includes("url.pathname==='/api/lorebooks'"),'src/entry.js: shadowed lorebook catalog route returned');

const hub=read('public/hub-dynamic.js');
for(const marker of ["fetch('/api/hub-resources?summary=1'","/api/hub-resources/${encodeURIComponent(id)}",'detailCache'])fail(hub.includes(marker),`public/hub-dynamic.js: progressive HUB loading missing ${marker}`);
const media=read('src/hub-public-media.js');
for(const marker of ['listHubResourcesSummaryPublic','getHubResourcePublic'])fail(media.includes(marker),`src/hub-public-media.js: progressive HUB API missing ${marker}`);

if(errors.length){console.error('\nARCHIVE.EXE architecture audit failed:\n- '+errors.join('\n- ')+'\n');process.exit(1)}
console.log('ARCHIVE.EXE architecture audit OK · shared top-level admin auth + isolated Telegram webhooks + progressive HUB + dead-route removal checked');
