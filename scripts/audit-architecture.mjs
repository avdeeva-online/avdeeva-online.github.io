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
fail(edge.includes('guardAdminApi(request,env,url)'),'src/cloudflare-entry-v2.js: top-level admin API guard missing');
fail(!app.includes("from './admin-auth.js'"),'src/cloudflare-entry.js: nested admin auth dependency returned');
fail(!app.includes('guardAdminApi('),'src/cloudflare-entry.js: duplicate nested admin guard returned');
fail(!/adminRequestBlocked\s*\(request,env,url\)/.test(edge),'src/cloudflare-entry-v2.js: per-route admin guard returned; use guardAdminApi once before dispatch');
fail(!/function\s+adminRequestBlocked\b/.test(edge),'src/cloudflare-entry-v2.js: duplicate adminRequestBlocked implementation returned');
fail(!/function\s+adminGuard\b/.test(app),'src/cloudflare-entry.js: duplicate adminGuard implementation returned');

for(const marker of ['export async function handleCloudflareRoute','export async function transformAdminHtmlResponse'])fail(app.includes(marker),`src/cloudflare-entry.js: explicit route/HTML transform contract missing ${marker}`);
for(const marker of ["from './source-truth.js'","from './universe-curation.js'","from './admin-auth.js'",'app.fetch(','.fetch(request,env,ctx)'])fail(!app.includes(marker),`src/cloudflare-entry.js: downstream wrapper/dependency returned ${marker}`);
for(const marker of ["import sourceTruth from './source-truth.js'","from './cloudflare-entry.js'","from './universe-curation.js'",'handleCloudflareRoute(request,env)','handleUniverseCurationRoute(request,env)','sourceTruth.fetch(request,env,ctx)','transformUniversePublicResponse(request,response,env)','transformAdminHtmlResponse(request,response)'])fail(edge.includes(marker),`src/cloudflare-entry-v2.js: top-level pipeline missing ${marker}`);
const cloudflareRoutePos=edge.indexOf('handleCloudflareRoute(request,env)');
const topCurationRoutePos=edge.indexOf('handleUniverseCurationRoute(request,env)');
const topSourceTruthPos=edge.indexOf('sourceTruth.fetch(request,env,ctx)');
const topCurationTransformPos=edge.indexOf('transformUniversePublicResponse(request,response,env)');
const adminHtmlTransformPos=edge.indexOf('transformAdminHtmlResponse(request,response)');
fail(cloudflareRoutePos>=0&&topCurationRoutePos>cloudflareRoutePos&&topSourceTruthPos>topCurationRoutePos&&topCurationTransformPos>topSourceTruthPos&&adminHtmlTransformPos>topCurationTransformPos,'src/cloudflare-entry-v2.js: top-level route/transform order changed');

const adminImportUi=read('public/admin/import/admin-v2.js');
for(const marker of ["/api/admin/import","/api/admin/import/status"])fail(adminImportUi.includes(marker),`public/admin/import/admin-v2.js: guarded admin import route missing ${marker}`);
for(const marker of ["fetch('/api/import'","/api/import/status?"])fail(!adminImportUi.includes(marker),`public/admin/import/admin-v2.js: blocked legacy import route returned ${marker}`);
for(const marker of ['forwardAdminImport','rewriteRequestPath',"/api/admin/import'","/api/admin/import/status'","'/api/import'","'/api/import/status'","'/api/admin/import/status'"])fail(edge.includes(marker),`src/cloudflare-entry-v2.js: guarded admin import adapter missing ${marker}`);
const adminImportPos=edge.indexOf("url.pathname==='/api/admin/import'");
const legacyImportBlockPos=edge.indexOf("url.pathname==='/api/import'||url.pathname==='/api/import/status'");
fail(adminImportPos>=0&&legacyImportBlockPos>adminImportPos,'src/cloudflare-entry-v2.js: guarded admin import must dispatch before blocked public import routes');

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

const curation=read('src/universe-curation.js');
for(const marker of ['export async function handleUniverseCurationRoute','export async function transformUniversePublicResponse','/api/admin/universe-curation'])fail(curation.includes(marker),`src/universe-curation.js: explicit curation contract missing ${marker}`);
for(const marker of ["from './source-truth.js'",'app.fetch('])fail(!curation.includes(marker),`src/universe-curation.js: downstream middleware wrapper returned ${marker}`);
for(const marker of ["import sourceTruth from './source-truth.js'","from './universe-curation.js'",'handleUniverseCurationRoute(request,env)','sourceTruth.fetch(request,env,ctx)','transformUniversePublicResponse(request,response,env)'])fail(edge.includes(marker),`src/cloudflare-entry-v2.js: explicit curation pipeline missing ${marker}`);

const mainRouter=read('src/main.js');
for(const marker of ['export async function handleMainRoute','/api/admin/creator-scan','/api/admin/universe-review'])fail(mainRouter.includes(marker),`src/main.js: flattened route contract missing ${marker}`);
for(const marker of ["from './entry.js'",'app.fetch('])fail(!mainRouter.includes(marker),`src/main.js: downstream wrapper returned ${marker}`);
const sourceTruthRouter=read('src/source-truth.js');
for(const marker of ["import { handleMainRoute } from './main.js'",'const mainResponse=await handleMainRoute(request,env)','if(mainResponse)return mainResponse'])fail(sourceTruthRouter.includes(marker),`src/source-truth.js: flattened main dispatch missing ${marker}`);
fail(!sourceTruthRouter.includes("import app from './main.js'"),'src/source-truth.js: nested main wrapper import returned');

const sourceTruthEntryRouter=read('src/source-truth.js');
for(const marker of ["import worker from './worker.js'","import { handleEntryRoute } from './entry.js'",'const entryResponse=await handleEntryRoute(request,env,ctx)','if(entryResponse)return entryResponse','const response=await worker.fetch(request,env,ctx)'])fail(sourceTruthEntryRouter.includes(marker),`src/source-truth.js: flattened entry dispatch missing ${marker}`);
for(const marker of ["import app from './entry.js'",'app.fetch('])fail(!sourceTruthEntryRouter.includes(marker),`src/source-truth.js: nested entry wrapper returned ${marker}`);

const entry=read('src/entry.js');
fail(entry.includes('export async function handleEntryRoute'),'src/entry.js: flattened route handler missing');
fail(!entry.includes('return worker.fetch(request,env,ctx)'),'src/entry.js: downstream worker wrapper returned');
fail(entry.includes('worker.fetch(new Request'),'src/entry.js: internal card lookup must keep direct base-worker access');
for(const marker of ['scanDatacatCreator','catalogCharacters','catalogLorebooks'])fail(!entry.includes(marker),`src/entry.js: shadowed legacy ${marker} returned`);
fail(!/page\s*<=\s*50/.test(entry),'src/entry.js: legacy 50-page scan returned');
fail(!entry.includes('url.pathname==="/api/characters"')&&!entry.includes("url.pathname==='/api/characters'"),'src/entry.js: shadowed character catalog route returned');
fail(!entry.includes('url.pathname==="/api/lorebooks"')&&!entry.includes("url.pathname==='/api/lorebooks'"),'src/entry.js: shadowed lorebook catalog route returned');

const getCardStart=entry.indexOf('async function getCard');
const getCardEnd=entry.indexOf('async function fetchJannyPng',getCardStart);
const getCardBody=getCardStart>=0&&getCardEnd>getCardStart?entry.slice(getCardStart,getCardEnd):'';
fail(getCardBody.includes('if(r.status!==200)'),'src/entry.js: queued/non-200 card responses must not be parsed as cards');
fail(!getCardBody.includes('if(!r.ok)'),'src/entry.js: broad 2xx card success check returned');

const avatarFetchStart=entry.indexOf('async function fetchAvatarPng');
const imageProxyStart=entry.indexOf('async function imageProxy',avatarFetchStart);
const pngDownloadStartEntry=entry.indexOf('async function pngDownload');
const jsonDownloadStartEntry=entry.indexOf('async function jsonDownload',pngDownloadStartEntry);
const avatarFetchBody=avatarFetchStart>=0&&imageProxyStart>avatarFetchStart?entry.slice(avatarFetchStart,imageProxyStart):'';
const pngDownloadBodyEntry=pngDownloadStartEntry>=0&&jsonDownloadStartEntry>pngDownloadStartEntry?entry.slice(pngDownloadStartEntry,jsonDownloadStartEntry):'';
fail(entry.includes('function allowedImageTarget'),'src/entry.js: shared image allowlist helper missing');
fail(avatarFetchBody.includes('allowedImageTarget(url)'),'src/entry.js: avatar PNG fetch bypasses shared image allowlist');
fail(!avatarFetchBody.includes('fetch(url,'),'src/entry.js: unrestricted avatar fetch returned');
fail(entry.includes('allowedImageTarget(raw)'),'src/entry.js: image proxy bypasses shared image allowlist');
for(const marker of ['canvasPngDataUrl','x-archive-png-fallback',"content-type':'text/html"])fail(!pngDownloadBodyEntry.includes(marker)&&!entry.includes(marker),`src/entry.js: retired PNG HTML fallback returned ${marker}`);
fail(pngDownloadBodyEntry.includes("state:'PNG_SOURCE_NOT_AVAILABLE'"),'src/entry.js: PNG endpoint must fail explicitly when no PNG source is available');

const workerBase=read('src/worker.js');
fail(workerBase.includes('lorebook_url:lore?\`${origin}/api/characters/${uuid}/lorebooks\`:""'),'src/worker.js: canonical lorebook URL missing from imported character bundle');
fail(!workerBase.includes('lorebook_url:lore?\`${origin}/api/characters/${uuid}/lorebook\`:""'),'src/worker.js: retired singular lorebook URL returned in imported character bundle');

for(const marker of ['url.pathname==="/api/health"','url.pathname==="/api/import/status"','url.pathname==="/api/import"','/card$/i'])fail(workerBase.includes(marker),`src/worker.js: required base route missing ${marker}`);
const cardDownloadStart=workerBase.indexOf('async function cardDownload');
const retrievalStatusStart=workerBase.indexOf('async function retrievalStatus',cardDownloadStart);
const cardDownloadBody=cardDownloadStart>=0&&retrievalStatusStart>cardDownloadStart?workerBase.slice(cardDownloadStart,retrievalStatusStart):'';
fail(cardDownloadBody.includes('statusUrl:\`${origin}/api/characters/${uuid}/card\`'),'src/worker.js: public queued card retry URL must point back to reachable card endpoint');
fail(!cardDownloadBody.includes('/api/import/status'),'src/worker.js: public card queue still points at blocked import status endpoint');
fail(workerBase.includes('statusUrl:\`${url.origin}/api/import/status?uuid=${uuid}\`'),'src/worker.js: internal admin import status URL unexpectedly removed');
for(const marker of ['/api/debug/datacat','async function lorebookDownload','const lore=url.pathname.match','const ch=url.pathname.match'])fail(!workerBase.includes(marker),`src/worker.js: shadowed route/helper returned ${marker}`);
for(const marker of ['/api/characters','/lorebooks$/i','/lorebooks\\/([0-9a-f]{32})$/i','/api\\/lorebooks\\/([0-9a-f]{32})$/i'])fail(sourceTruthEntryRouter.includes(marker),`src/source-truth.js: canonical lorebook ownership missing ${marker}`);
for(const marker of ['legacyLorebookDownload','/lorebook$/i'])fail(!sourceTruthEntryRouter.includes(marker),`src/source-truth.js: retired singular lorebook compatibility returned ${marker}`);

const cardDownloadUi=read('public/png-download.js');
for(const marker of ['async function fetchReadyCard','res.status===200','res.status!==202','CARD_STILL_PROCESSING','async function downloadJson','async function downloadPng','window.ARCHIVE_DOWNLOAD_JSON','window.ARCHIVE_DOWNLOAD_PNG'])fail(cardDownloadUi.includes(marker),`public/png-download.js: queued download contract missing ${marker}`);
fail(!cardDownloadUi.includes('if(!cardRes.ok)'),'public/png-download.js: broad 2xx card success check returned');
fail(!cardDownloadUi.includes('cardRes.ok'),'public/png-download.js: stale Response.ok card readiness check returned');
fail(cardDownloadUi.includes('a[href*="/api/characters/"]'),'public/png-download.js: JSON/PNG card click interception missing');
const charactersHtml=read('public/characters.html');
fail(charactersHtml.includes('png-download.js?v=20260919-download-state1'),'public/characters.html: card download cache-bust missing');

const hubResources=read('src/hub-resources.js');
for(const marker of ['export async function hubStorageStatus','export async function migrateHubFilesToR2','export async function injectHubResources'])fail(!hubResources.includes(marker),`src/hub-resources.js: retired R2 compatibility export returned ${marker}`);
for(const marker of ["from './hub-r2-migration.js'",'hubStorageStatusSafe','migrateHubFilesToR2Safe'])fail(edge.includes(marker),`src/cloudflare-entry-v2.js: safe R2 migration route missing ${marker}`);

const hub=read('public/hub-dynamic.js');
for(const marker of ["fetch('/api/hub-resources?summary=1'","/api/hub-resources/${encodeURIComponent(id)}",'detailCache'])fail(hub.includes(marker),`public/hub-dynamic.js: progressive HUB loading missing ${marker}`);
const media=read('src/hub-public-media.js');
for(const marker of ['listHubResourcesSummaryPublic','getHubResourcePublic'])fail(media.includes(marker),`src/hub-public-media.js: progressive HUB API missing ${marker}`);

if(errors.length){console.error('\nARCHIVE.EXE architecture audit failed:\n- '+errors.join('\n- ')+'\n');process.exit(1)}
console.log('ARCHIVE.EXE architecture audit OK · shared top-level admin auth + read-only D1 schema status + isolated Telegram webhooks + shared Telegram admin transport/UI + stable admin Telegram router + extracted admin menu/stats/read-only views + staged-file-safe HUB issues + read-only drafts/suggestions listings + self-contained fixed admin flow + progressive HUB + single top-level Worker pipeline + guarded admin import + explicit universe curation + flattened main + entry routers + queued JSON/PNG downloads + canonical lorebook URL + PNG contract + card queue safety + shadowed worker + singular lorebook compatibility removal checked');
