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

fail(exists('src/d1-schema-status.js'),'src/d1-schema-status.js: read-only D1 schema status module missing');
if(exists('src/d1-schema-status.js')){
  const schemaStatus=read('src/d1-schema-status.js');
  for(const marker of ['d1SchemaStatus','PRAGMA table_info','PRAGMA index_list','PRAGMA index_info','hub_resource_publish_files','storage','r2_key','archive_schema','characters_identity','read_only:true'])fail(schemaStatus.includes(marker),`src/d1-schema-status.js: schema status contract missing ${marker}`);
  for(const marker of ['INSERT ','UPDATE ','DELETE ','ALTER TABLE','CREATE TABLE','DROP TABLE'])fail(!schemaStatus.includes(marker),`src/d1-schema-status.js: read-only schema status contains mutation/DDL marker ${marker}`);
}
fail(edge.includes("from './d1-schema-status.js'"),'src/cloudflare-entry-v2.js: D1 schema status module not imported');
fail(edge.includes("url.pathname==='/api/admin/schema-status'"),'src/cloudflare-entry-v2.js: /api/admin/schema-status route missing');

fail(exists('src/telegram-webhooks.js'),'src/telegram-webhooks.js: isolated webhook helper missing');
if(exists('src/telegram-webhooks.js')){
  const telegramWebhooks=read('src/telegram-webhooks.js');
  for(const marker of ['setupTelegramWebhooks','telegramWebhookStatus','setWebhook','getWebhookInfo'])fail(telegramWebhooks.includes(marker),`src/telegram-webhooks.js: missing ${marker}`);
}
fail(app.includes("from './telegram-webhooks.js'"),'src/cloudflare-entry.js: Telegram webhook helpers not isolated');
fail(!app.includes("from './telegram-bots.js'"),'src/cloudflare-entry.js: legacy telegram-bots.js dependency returned');

fail(exists('src/telegram-admin-shared.js'),'src/telegram-admin-shared.js: shared Telegram admin primitives missing');
if(exists('src/telegram-admin-shared.js')){
  const shared=read('src/telegram-admin-shared.js');
  for(const marker of ['webhookSecret','admin|${token}','tg(','send(','edit(','answerCb','adminMenu','adminMenuText'])fail(shared.includes(marker),`src/telegram-admin-shared.js: shared primitive missing ${marker}`);
}

fail(exists('src/telegram-admin-router.js'),'src/telegram-admin-router.js: stable admin Telegram route seam missing');
if(exists('src/telegram-admin-router.js')){
  const telegramAdminRouter=read('src/telegram-admin-router.js');
  for(const marker of ["from './telegram-admin-menu.js'","from './telegram-admin-stats.js'","from './telegram-admin-readonly.js'","from './telegram-admin-fixed.js'",'handleAdminTelegramRoute','tryHandleAdminMenuRequest(request,env)','tryHandleAdminStatsRequest(request,env)','tryHandleAdminReadonlyRequest(request,env)'])fail(telegramAdminRouter.includes(marker),`src/telegram-admin-router.js: route chain missing ${marker}`);
  fail(!telegramAdminRouter.includes("from './telegram-bots.js'"),'src/telegram-admin-router.js: legacy bot must stay behind fixed handler, not the route seam');
}
fail(edge.includes("from './telegram-admin-router.js'"),'src/cloudflare-entry-v2.js: admin Telegram route bypasses stable router seam');
fail(edge.includes("url.pathname==='/telegram/admin')return handleAdminTelegramRoute(request,env)"),'src/cloudflare-entry-v2.js: /telegram/admin is not routed through stable seam');
fail(!edge.includes("from './telegram-admin-fixed.js'"),'src/cloudflare-entry-v2.js: direct telegram-admin-fixed dependency returned');

fail(exists('src/telegram-admin-menu.js'),'src/telegram-admin-menu.js: extracted static admin menu handler missing');
if(exists('src/telegram-admin-menu.js')){
  const menu=read('src/telegram-admin-menu.js');
  for(const marker of ["from './telegram-admin-shared.js'",'tryHandleAdminMenuRequest','/start','/menu','adm:home','noop'])fail(menu.includes(marker),`src/telegram-admin-menu.js: static menu behavior missing ${marker}`);
  for(const marker of ['function webhookSecret','function tg(','function send(','function edit(','function answerCb'])fail(!menu.includes(marker),`src/telegram-admin-menu.js: duplicate shared Telegram primitive returned ${marker}`);
}

fail(exists('src/telegram-admin-stats.js'),'src/telegram-admin-stats.js: extracted read-only admin stats handler missing');
if(exists('src/telegram-admin-stats.js')){
  const stats=read('src/telegram-admin-stats.js');
  for(const marker of ["from './telegram-admin-shared.js'",'tryHandleAdminStatsRequest','adm:stats',"hub_resources WHERE status='published'","telegram_admin_drafts WHERE status='review'","hub_suggestions WHERE status='new'",'SELECT COUNT(*) n FROM characters','SELECT COUNT(*) n FROM hub_resource_files'])fail(stats.includes(marker),`src/telegram-admin-stats.js: stats behavior missing ${marker}`);
  for(const marker of ['INSERT ','UPDATE ','DELETE ','ALTER TABLE','CREATE TABLE'])fail(!stats.includes(marker),`src/telegram-admin-stats.js: read-only stats handler contains write/DDL marker ${marker}`);
  for(const marker of ['function webhookSecret','function tg(','function send(','function edit(','function answerCb'])fail(!stats.includes(marker),`src/telegram-admin-stats.js: duplicate shared Telegram primitive returned ${marker}`);
}

fail(exists('src/telegram-admin-readonly.js'),'src/telegram-admin-readonly.js: extracted read-only admin views missing');
if(exists('src/telegram-admin-readonly.js')){
  const readonly=read('src/telegram-admin-readonly.js');
  for(const marker of ["from './telegram-admin-shared.js'","from './d1-schema.js'","from './telegram-admin-suggestions-view.js'",'tryHandleAdminReadonlyRequest','adm:hub','adm:authors','adm:issues','adm:drafts','adm:suggestions',"SELECT id,title,type,creator_name FROM hub_resources WHERE status='published'","SELECT creator_name,COUNT(*) n FROM hub_resources WHERE status='published' AND creator_name!=''",'hub_resource_publish_files sf','NO DOWNLOAD FILE',"SELECT id,source_url,payload,status,updated_at FROM telegram_admin_drafts WHERE status='review' ORDER BY updated_at DESC LIMIT 8",'telegram_admin_import_session','draft:view:','showAdminSuggestions','No drafts waiting for review.','OPEN HUB ↗','<b>AUTHORS</b>','<b>HUB ISSUES</b>'])fail(readonly.includes(marker),`src/telegram-admin-readonly.js: read-only view behavior missing ${marker}`);
  for(const marker of ['INSERT ','UPDATE ','DELETE ','ALTER TABLE','CREATE TABLE'])fail(!readonly.includes(marker),`src/telegram-admin-readonly.js: read-only handler contains write/DDL marker ${marker}`);
}

fail(exists('src/telegram-admin-suggestions-view.js'),'src/telegram-admin-suggestions-view.js: shared suggestions view missing');
if(exists('src/telegram-admin-suggestions-view.js')){
  const suggestionsView=read('src/telegram-admin-suggestions-view.js');
  for(const marker of ["from './d1-schema.js'","from './telegram-admin-shared.js'",'showAdminSuggestions',"SELECT id,url,note,created_at FROM hub_suggestions WHERE status='new' ORDER BY created_at DESC LIMIT 6",'sug:import:','sug:ignore:','Inbox is empty.','<b>COMMUNITY SUGGESTIONS</b>'])fail(suggestionsView.includes(marker),`src/telegram-admin-suggestions-view.js: suggestions view contract missing ${marker}`);
  for(const marker of ['INSERT ','UPDATE ','DELETE ','ALTER TABLE','CREATE TABLE'])fail(!suggestionsView.includes(marker),`src/telegram-admin-suggestions-view.js: read-only suggestions view contains write/DDL marker ${marker}`);
}

fail(exists('src/telegram-admin-fixed.js'),'src/telegram-admin-fixed.js: fixed admin Telegram handler missing');
fail(!exists('src/telegram-bots.js'),'src/telegram-bots.js: retired legacy Telegram bundle returned');
if(exists('src/telegram-admin-fixed.js')){
  const fixed=read('src/telegram-admin-fixed.js');
  fail(!fixed.includes("from './telegram-bots.js'"),'src/telegram-admin-fixed.js: legacy Telegram fallback dependency returned');
  fail(!fixed.includes('handleAdminTelegram('),'src/telegram-admin-fixed.js: legacy Telegram fallback dispatch returned');
  fail(fixed.includes("from './telegram-admin-shared.js'"),'src/telegram-admin-fixed.js: shared Telegram transport not imported');
  for(const marker of ['function webhookSecret','function tg(','function send(','function edit(','function answerCb','const clean=','const esc='])fail(!fixed.includes(marker),`src/telegram-admin-fixed.js: duplicate shared Telegram primitive returned ${marker}`);
  for(const marker of ['adm:import','session:new','session:finish','session:resume:','draft:view:','draft:reanalyze:','draft:publish:','draft:delete:','sug:ignore:','sug:import:',"status='ignored'","status='reviewing'",'showAdminSuggestions','METHOD_NOT_ALLOWED','ADMIN_BOT_TOKEN_MISSING','INVALID_WEBHOOK_SECRET','INVALID_JSON','ADMIN BOT ERROR','Access denied','Once a resource is active'])fail(fixed.includes(marker),`src/telegram-admin-fixed.js: fixed callback/transport contract missing ${marker}`);
}

const mainRouter=read('src/main.js');
for(const marker of ['export async function handleMainRoute','/api/admin/creator-scan','/api/admin/universe-review'])fail(mainRouter.includes(marker),`src/main.js: flattened route contract missing ${marker}`);
for(const marker of ["from './entry.js'",'app.fetch('])fail(!mainRouter.includes(marker),`src/main.js: downstream wrapper returned ${marker}`);
const sourceTruthRouter=read('src/source-truth.js');
for(const marker of ["import app from './entry.js'","import { handleMainRoute } from './main.js'",'const mainResponse=await handleMainRoute(request,env)','if(mainResponse)return mainResponse'])fail(sourceTruthRouter.includes(marker),`src/source-truth.js: flattened main dispatch missing ${marker}`);
fail(!sourceTruthRouter.includes("import app from './main.js'"),'src/source-truth.js: nested main wrapper import returned');

const entry=read('src/entry.js');
for(const marker of ['scanDatacatCreator','catalogCharacters','catalogLorebooks'])fail(!entry.includes(marker),`src/entry.js: shadowed legacy ${marker} returned`);
fail(!/page\s*<=\s*50/.test(entry),'src/entry.js: legacy 50-page scan returned');
fail(!entry.includes('url.pathname==="/api/characters"')&&!entry.includes("url.pathname==='/api/characters'"),'src/entry.js: shadowed character catalog route returned');
fail(!entry.includes('url.pathname==="/api/lorebooks"')&&!entry.includes("url.pathname==='/api/lorebooks'"),'src/entry.js: shadowed lorebook catalog route returned');

const hubResources=read('src/hub-resources.js');
for(const marker of ['export async function hubStorageStatus','export async function migrateHubFilesToR2','export async function injectHubResources'])fail(!hubResources.includes(marker),`src/hub-resources.js: retired R2 compatibility export returned ${marker}`);
for(const marker of ["from './hub-r2-migration.js'",'hubStorageStatusSafe','migrateHubFilesToR2Safe'])fail(edge.includes(marker),`src/cloudflare-entry-v2.js: safe R2 migration route missing ${marker}`);

const hub=read('public/hub-dynamic.js');
for(const marker of ["fetch('/api/hub-resources?summary=1'","/api/hub-resources/${encodeURIComponent(id)}",'detailCache'])fail(hub.includes(marker),`public/hub-dynamic.js: progressive HUB loading missing ${marker}`);
const media=read('src/hub-public-media.js');
for(const marker of ['listHubResourcesSummaryPublic','getHubResourcePublic'])fail(media.includes(marker),`src/hub-public-media.js: progressive HUB API missing ${marker}`);

if(errors.length){console.error('\nARCHIVE.EXE architecture audit failed:\n- '+errors.join('\n- ')+'\n');process.exit(1)}
console.log('ARCHIVE.EXE architecture audit OK · shared top-level admin auth + read-only D1 schema status + isolated Telegram webhooks + shared Telegram admin transport/UI + stable admin Telegram router + extracted admin menu/stats/read-only views + staged-file-safe HUB issues + read-only drafts/suggestions listings + self-contained fixed admin flow + progressive HUB + flattened main router + dead-route removal checked');
