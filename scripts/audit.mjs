import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const errors=[];
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const walk=dir=>{const out=[];for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const rel=path.join(dir,e.name);if(e.isDirectory())out.push(...walk(rel));else out.push(rel)}return out};
const fail=(ok,msg)=>{if(!ok)errors.push(msg)};

const sourceFiles=walk('src').filter(f=>f.endsWith('.js'));
for(const file of sourceFiles){const text=read(file);for(const m of text.matchAll(/(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"](\.\.?\/[^'"]+)['"]/g)){let target=path.normalize(path.join(path.dirname(file),m[1]));if(!path.extname(target))target+='.js';if(!exists(target))errors.push(`${file}: missing import ${m[1]} -> ${target}`)}}

const retired=['telegram-admin-ingest.js','telegram-admin-smart.js','telegram-admin-bot.js','telegram-bots.js','hub-media-recovery.js'];
for(const file of [...sourceFiles,...walk('public').filter(f=>/\.(?:js|html)$/.test(f))]){const text=read(file);for(const name of retired){if(text.includes(name))errors.push(`${file}: still references retired ${name}`)}}

for(const file of walk('public/admin/hub').filter(f=>f.endsWith('.js'))){const text=read(file);if(/window\.fetch\s*=/.test(text))errors.push(`${file}: fetch monkey patch reintroduced`)}

for(const file of walk('public').filter(f=>f.endsWith('.html'))){const html=read(file);for(const m of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type=["']module["'])[^>]*>([\s\S]*?)<\/script>/gi)){const code=m[1].trim();if(!code)continue;try{new Function(code)}catch(e){errors.push(`${file}: inline script syntax error: ${e.message}`)}}}

const wrangler=read('wrangler.toml');
for(const route of ['/admin/*','/api/*','/telegram/*','/hub.html'])fail(wrangler.includes(`"${route}"`),`wrangler.toml: run_worker_first missing ${route}`);
fail(wrangler.includes('main = "src/cloudflare-entry-v2.js"'),'wrangler.toml: unexpected worker entrypoint');
fail(wrangler.includes('[[r2_buckets]]')&&wrangler.includes('binding = "HUB_FILES"'),'wrangler.toml: HUB_FILES R2 binding missing');

const migrationFiles=['migrations/0001_baseline.sql','migrations/0002_universe_curation_seed.sql','migrations/0003_hub_storage_normalize.sql','migrations/0004_source_truth_marker.sql'];
for(const file of migrationFiles)fail(exists(file),`D1 migration missing: ${file}`);
const baseline=migrationFiles[0];
if(exists(baseline)){
  const sql=read(baseline);
  for(const table of ['characters','lorebooks','lorebook_blobs','lorebook_sources','character_lorebooks','hub_resources','hub_resource_files','hub_resource_file_chunks','hub_resource_publish_sessions','hub_resource_publish_files','telegram_admin_drafts','telegram_admin_import_session','hub_suggestions','universe_curation','admin_universe_review'])fail(sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`),`${baseline}: missing ${table}`);
  fail(sql.includes('storage TEXT NOT NULL DEFAULT \'d1\''),`${baseline}: HUB R2 storage column missing`);
  fail(sql.includes("r2_key TEXT NOT NULL DEFAULT ''"),`${baseline}: HUB r2_key column missing`);
}
if(exists(migrationFiles[1]))fail(read(migrationFiles[1]).includes('INSERT OR IGNORE INTO universe_curation'),`${migrationFiles[1]}: universe seed missing`);
if(exists(migrationFiles[2]))fail(read(migrationFiles[2]).includes("SET storage='remote'"),`${migrationFiles[2]}: HUB storage normalization missing`);
if(exists(migrationFiles[3]))fail(read(migrationFiles[3]).includes("source-truth-v5"),`${migrationFiles[3]}: source-truth schema marker missing`);

for(const file of sourceFiles){const text=read(file);if(/\b(?:CREATE\s+(?:TABLE|INDEX)|ALTER\s+TABLE)\b/i.test(text))errors.push(`${file}: runtime D1 DDL is forbidden; add a numbered migration instead`)}
fail(exists('src/d1-schema.js'),'src/d1-schema.js: read-only migration guard missing');
if(exists('src/d1-schema.js')){const guard=read('src/d1-schema.js');fail(guard.includes('D1_MIGRATION_REQUIRED'),'src/d1-schema.js: explicit migration failure missing');if(/\b(?:CREATE\s+(?:TABLE|INDEX)|ALTER\s+TABLE)\b/i.test(guard))errors.push('src/d1-schema.js: schema guard must stay read-only')}
for(const file of ['src/hub-resources.js','src/source-truth.js','src/telegram-admin-fixed.js','src/telegram-drafts-admin.js','src/universe-curation.js','src/main.js','src/hub-public-media.js','src/hub-r2-migration.js','src/hub-suggestions.js']){const text=read(file);fail(text.includes('D1_MIGRATION_REQUIRED')||text.includes('requireD1Schema'),`${file}: missing read-only migration guard`)}

const hub=read('public/hub-dynamic.js');
fail(hub.includes('extraFile(f)&&imageFile(f)'),'public/hub-dynamic.js: EXTRAS must use explicit extra flag');
fail(hub.includes('downloadFiles=files.filter(f=>!extraFile(f))'),'public/hub-dynamic.js: downloads must exclude EXTRAS');

const catalog=read('public/characters.html');
if(/id=["']importOpen["']/.test(catalog))errors.push('public/characters.html: public import control returned');

const entry=read('src/cloudflare-entry-v2.js');
fail(entry.includes("url.pathname==='/api/import'"),'src/cloudflare-entry-v2.js: public import guard missing');
fail(entry.includes("url.pathname==='/api/debug/datacat'"),'src/cloudflare-entry-v2.js: public debug guard missing');
fail(entry.includes("url.pathname==='/api/admin/hub-storage'"),'src/cloudflare-entry-v2.js: guarded HUB storage route missing');
fail(entry.includes("from './hub-r2-migration.js'"),'src/cloudflare-entry-v2.js: safe HUB R2 migration helper not wired');

const adminEdit=read('public/admin/hub/admin-edit.js');
for(const marker of ["'begin'","?action=upload","'finalize'","'cancel'"])fail(adminEdit.includes(marker),`public/admin/hub/admin-edit.js: staged publish missing ${marker}`);
fail(adminEdit.includes('_publish_session'),'public/admin/hub/admin-edit.js: publish session id not propagated');
for(const marker of ['PUBLISH_SESSION_FINALIZE_REQUIRED','RECOVERING FINALIZE','FINALIZE RECOVERY'])fail(adminEdit.includes(marker),`public/admin/hub/admin-edit.js: finalize recovery missing ${marker}`);

const resources=read('src/hub-resources.js');
for(const table of ['hub_resource_publish_sessions','hub_resource_publish_files'])fail(resources.includes(table),`src/hub-resources.js: staging table missing ${table}`);
fail(resources.includes("status='published'"),'src/hub-resources.js: published-state guard missing');
for(const marker of ['cleanupStaleSessions','retireStoredFile',"phase:'editing'","state.phase='committing'",'oldPrimaryId','PUBLISH_SESSION_FINALIZE_REQUIRED',"state.phase==='committing'",'finalizeRequired:true',"await finalizeSession(env,row.id)"])fail(resources.includes(marker),`src/hub-resources.js: recoverable publish lifecycle missing ${marker}`);
for(const marker of ["env.DB.batch([removeRow","DELETE FROM hub_resource_publish_files WHERE session_id=?","DELETE FROM hub_resource_publish_sessions WHERE id=?"])fail(resources.includes(marker),`src/hub-resources.js: atomic/logical lifecycle cleanup missing ${marker}`);
for(const marker of ['staged file cleanup failed','published resource old-file cleanup failed'])fail(!resources.includes(marker),`src/hub-resources.js: swallowed lifecycle cleanup returned ${marker}`);
fail(resources.includes("try{await deleteStoredFile(env,fileId,resourceId)}catch(e){return json"),'src/hub-resources.js: strict live-file delete contract missing');
for(const marker of ['HUB_FILES.put','HUB_FILES.get','r2_key','R2_BINDING_REQUIRED'])fail(resources.includes(marker),`src/hub-resources.js: R2 dual-storage marker missing ${marker}`);
for(const marker of ['SOURCE_PREFIX','added_files','cleanupUnreferencedSourceMedia',"action==='metadata'"])fail(resources.includes(marker),`src/hub-resources.js: SOURCE media staging contract missing ${marker}`);

const migration=read('src/hub-r2-migration.js');
for(const marker of ['migrateHubFilesToR2Safe','hubStorageStatusSafe','HUB_FILES',"storage='r2'",'post-migration D1 cleanup failed'])fail(migration.includes(marker),`src/hub-r2-migration.js: safe migration marker missing ${marker}`);

const drafts=read('src/telegram-drafts-admin.js');
fail(!/telegram-extra-/i.test(drafts),'src/telegram-drafts-admin.js: SOURCE media is still converted to legacy EXTRAS');
fail(!drafts.includes('bytesToDataUrl'),'src/telegram-drafts-admin.js: SOURCE media is still stored as base64 data URLs');
for(const marker of ['downloadSourceMedia','source__','action=metadata','telegram-source-r2'])fail(drafts.includes(marker),`src/telegram-drafts-admin.js: SOURCE→R2 flow missing ${marker}`);
fail(drafts.includes("if('media'in b)"),'src/telegram-drafts-admin.js: media edits are not persisted');
const bridge=read('public/admin/hub/draft-bridge.js');
fail(bridge.includes('media:mediaPayload()'),'public/admin/hub/draft-bridge.js: Telegram draft media state not submitted');

const publicMedia=read('src/hub-public-media.js');
fail(!publicMedia.includes('legacyExtraIds'),'src/hub-public-media.js: legacy EXTRAS synthesis still active');
fail(!publicMedia.includes("source:'legacy-media'"),'src/hub-public-media.js: virtual media EXTRAS still active');
for(const marker of ['HUB_FILES','row.storage','row.r2_key','ensureStorageColumns','isSource','source_files','media_model:6'])fail(publicMedia.includes(marker),`src/hub-public-media.js: public SOURCE/R2 contract missing ${marker}`);

const publicApp=read('public/app.js');
for(const marker of ['enemy to lovers','enemies to lovers'])fail(publicApp.includes(marker),`public/app.js: defensive tag alias parity missing ${marker}`);
for(const marker of ['const visibleBotHashtags = bot =>','const hashtags = visibleBotHashtags(b)','hashtags.slice(0,3)','const modalHashtags=visibleBotHashtags(b)'])fail(publicApp.includes(marker),`public/app.js: visible hashtag dedupe missing ${marker}`);
const catalogApi=read('public/catalog-api.js');
for(const marker of ["function publishBots(list){window.BOTS=list;window.dispatchEvent(new CustomEvent('archive:catalog-updated'","publishBots(liveBots)","publishBots(fallback)"])fail(catalogApi.includes(marker),`public/catalog-api.js: single catalog publication path missing ${marker}`);
for(const marker of ["window.render()","function setBots(list)"])fail(!catalogApi.includes(marker),`public/catalog-api.js: duplicate direct catalog render returned ${marker}`);
for(const marker of ["window.addEventListener('archive:catalog-updated'","const liveCatalogRender=render"])fail(publicApp.includes(marker),`public/app.js: catalog update render listener missing ${marker}`);
for(const marker of ['attempts < 20','setTimeout(paint, 60)','window.addEventListener("load", ()=>'])fail(!publicApp.includes(marker),`public/app.js: duplicate catalog boot render path returned ${marker}`);
for(const marker of ['function normalizeHashtags(values)','hashtags:normalizeHashtags(b.hashtags)'])fail(catalogApi.includes(marker),`public/catalog-api.js: fallback hashtag normalization missing ${marker}`);
const charactersHtml=read('public/characters.html');
for(const marker of ['app.js?v=20260919-render-slices1','catalog-api.js?v=20260919-render-boot1'])fail(charactersHtml.includes(marker),`public/characters.html: hashtag cache-bust missing ${marker}`);
const publicCharacters=read('public/characters.html');
const publicCatalogApi=read('public/catalog-api.js');
for(const [name,body] of [['public/app.js',publicApp],['public/catalog-api.js',publicCatalogApi]])for(const marker of ['high-school','school','university','college'])fail(body.includes(marker),`${name}: school/university canonical setting contract missing ${marker}`);
fail(publicApp.includes('["high-school","school","university","college"].includes'),'public/app.js: school/university setting aliases are not canonicalized together');
fail(publicCatalogApi.includes("['high-school','school','university','college'].includes"),'public/catalog-api.js: catalog school/university setting aliases are not canonicalized together');
for(const marker of ['const isPovTag = value =>','if(isPovTag(tag))return','const visibleBotTags = bot =>','const tags = visibleBotTags(b)','const modalTags=visibleBotTags(b)','$("#modalPov").textContent=povLabel(botPov(b))','card-status-icon card-pov-icon','povSymbol(pov)'])fail(publicApp.includes(marker),`public/app.js: separated/canonical POV-tag contract missing ${marker}`);
fail(!publicApp.includes('$("#modalPov").textContent=""'),'public/app.js: modal POV display is still being cleared');
const cardHtmlStart=publicApp.indexOf('function cardHtml');
const quickTagsStart=publicApp.indexOf('function renderQuickTags',cardHtmlStart);
const cardHtmlBody=cardHtmlStart>=0&&quickTagsStart>cardHtmlStart?publicApp.slice(cardHtmlStart,quickTagsStart):'';
for(const marker of ['const tagChip = tag => \`<span>','const hashtagChip = hashtag => \`<span>','if(passiveCardTags){e.stopPropagation();return}'])fail(publicApp.includes(marker),`public/app.js: passive list-card tag contract missing ${marker}`);
for(const marker of ['data-tag=','data-hashtag='])fail(!cardHtmlBody.includes(marker),`public/app.js: list-card tag region may still be interactive via ${marker}`);
fail(publicCharacters.includes('app.js?v=20260919-render-slices1'),'public/characters.html: public app cache-bust missing');
fail(publicCharacters.includes('catalog-api.js?v=20260919-render-boot1'),'public/characters.html: catalog API cache-bust missing');

const main=read('src/main.js');
for(const marker of ['SCAN_DEADLINE_MS','SCAN_FETCH_MS','SCAN_PAGE_LIMIT','AbortController','preferred_variant'])fail(main.includes(marker),`src/main.js: bounded creator scan missing ${marker}`);
if(/page\s*<=\s*50/.test(main))errors.push('src/main.js: legacy 50-page creator scan returned');

fail(exists('src/lorebook-cleanup.js'),'src/lorebook-cleanup.js: targeted lorebook cleanup helper missing');
if(exists('src/lorebook-cleanup.js')){
  const l=read('src/lorebook-cleanup.js');
  for(const marker of ['linkedLorebooksForCharacter','planDetachedLorebookCleanup','detachedLorebookCleanupStatements','cleanupDetachedLorebooks','JOIN characters c ON c.janitor_uuid=cl.character_uuid','DELETE FROM character_lorebooks WHERE lorebook_id=?','DELETE FROM lorebook_sources WHERE lorebook_id=?','DELETE FROM lorebooks WHERE id=?','DELETE FROM lorebook_blobs WHERE content_hash=?','env.DB.batch(statements)'])fail(l.includes(marker),`src/lorebook-cleanup.js: atomic targeted cleanup missing ${marker}`);
}
fail(exists('src/filter-normalization.js'),'src/filter-normalization.js: shared filter normalizer missing');
if(exists('src/filter-normalization.js')){const n=read('src/filter-normalization.js');for(const marker of ['export function normalizeHashtags','export function semanticTagKey','export function normalizeTags','enemy to lovers','enemies to lovers','replace(/^#+\\s*/','toLocaleLowerCase()','seen.has(key)'])fail(n.includes(marker),`src/filter-normalization.js: filter normalization missing ${marker}`)}
const baseWorker=read('src/worker.js');
for(const marker of ["import { normalizeHashtags, normalizeTags } from './filter-normalization.js'","return normalizeHashtags(Array.isArray(c?.custom_tags)?c.custom_tags:[])","return normalizePovTags(normalizeTags((Array.isArray(c?.tags)?c.tags:[])"])fail(baseWorker.includes(marker),`src/worker.js: imported filter normalization missing ${marker}`);

const discovery=read('src/discovery.js');
for(const marker of ['export function canonicalSettingId','export function normalizeSettingIds',"['high-school','school','university','college'].includes(id)?'college':id"])fail(discovery.includes(marker),`src/discovery.js: canonical setting normalizer missing ${marker}`);
const characterAdmin=read('src/character-admin.js');
for(const marker of ["from './filter-normalization.js'","tags:normalizeTags(parse(r.tags))","hashtags:normalizeHashtags(parse(r.hashtags))","hashtags=normalizeHashtags(b.hashtags)","const tags=normalizeTags([...arr(b.tags).filter(x=>!isPovTag(x)),povTag])"])fail(characterAdmin.includes(marker),`src/character-admin.js: normalized filter contract missing ${marker}`);
const characterEditor=read('public/admin/import/character-editor.js');
const characterEditorHtml=read('public/admin/import/edit.html');
for(const marker of ['export function settingDefinitions','SETTING_DEFINITIONS.map(({id,label,aliases})'])fail(discovery.includes(marker),`src/discovery.js: reusable setting taxonomy missing ${marker}`);
for(const marker of ["from './discovery.js'","settingDefinitions","normalizeUniverses","settingDefinitions:settingDefinitions()"])fail(characterAdmin.includes(marker),`src/character-admin.js: admin setting taxonomy contract missing ${marker}`);
for(const marker of ['settingDefs=[]','d.settingDefinitions','settingDefs.map(x=>x.id)','selected.settings=new Set(r.setting_ids||[])','isPovTag','selected.tags=new Set((r.tags||[]).filter(x=>!isPovTag(x)))'])fail(characterEditor.includes(marker),`public/admin/import/character-editor.js: setting/POV editor contract missing ${marker}`);
for(const marker of ['const canonicalSettings=',"historical'?'medieval'","magic'?'fantasy'"])fail(!characterEditor.includes(marker),`public/admin/import/character-editor.js: destructive legacy setting normalization returned ${marker}`);
fail(characterEditorHtml.includes('character-editor.js?v=20260919-setting-contract1'),'public/admin/import/edit.html: character editor cache-bust missing');

for(const marker of ["normalizeUniverses(b.universes)","normalizeUniverses(parse(current.universes).length?parse(current.universes):[current.universe])","normalizeSettingIds(b.setting_ids)"])fail(characterAdmin.includes(marker),`src/character-admin.js: filter value normalization missing ${marker}`);
fail(!characterAdmin.includes('const canonicalSettingId='),'src/character-admin.js: duplicate local setting normalizer returned');
for(const marker of ['const universes=uniq(b.universes)','settingIds=uniq(b.setting_ids)'])fail(!characterAdmin.includes(marker),`src/character-admin.js: raw slash-combo normalization returned ${marker}`);
for(const marker of ['planDetachedLorebookCleanup','detachedLorebookCleanupStatements','planAffectedLorebookUniverseChanges','lorebookUniverseChangeStatements','await env.DB.batch(statements)','excludingCharacterUuid:uuid','universeRepair'])fail(characterAdmin.includes(marker),`src/character-admin.js: atomic character/lorebook delete lifecycle missing ${marker}`);
for(const marker of ['catch(()=>[])','catch(()=>({entities:0,sources:0,blobs:0}))',"try{await env.DB.prepare('DELETE FROM character_lorebooks"])fail(!characterAdmin.includes(marker),`src/character-admin.js: swallowed character-delete cleanup returned ${marker}`);

fail(exists('src/lorebook-universe-repair.js'),'src/lorebook-universe-repair.js: targeted universe repair helper missing');
if(exists('src/lorebook-universe-repair.js')){
  const repair=read('src/lorebook-universe-repair.js');
  for(const marker of ['repairAffectedLorebookUniverses','repairAllLorebookUniverses','planAffectedLorebookUniverseChanges','lorebookUniverseChangeStatements','collectRepairChanges','_archive_previous_source','character_lorebooks','excludeUuids','cleared','UPDATE characters SET universe=?,universes=?,universe_source_field=?,updated_at=CURRENT_TIMESTAMP WHERE janitor_uuid=?'])fail(repair.includes(marker),`src/lorebook-universe-repair.js: repair/planner contract missing ${marker}`);
}
const sourceTruth=read('src/source-truth.js');
for(const marker of ["from './filter-normalization.js'","hashtags:normalizeHashtags(arr(r.hashtags))","normalizePovTags(normalizeTags(oldTags))","normalizePovTags(normalizeTags(arr(r.tags)))","normalizePovTags(normalizeTags(arr(row.tags)))"])fail(sourceTruth.includes(marker),`src/source-truth.js: public tag/hashtag normalization missing ${marker}`);
for(const marker of ['normalizeSettingIds(storedSettings)','normalizeSettingIds(inferSettingIds(null,r))'])fail(sourceTruth.includes(marker),`src/source-truth.js: public setting normalization missing ${marker}`);
for(const marker of ["from './lorebook-universe-repair.js'",'affectedLorebookIds','repairAffectedLorebookUniverses(env,uuid','repairAllLorebookUniverses(env)'])fail(sourceTruth.includes(marker),`src/source-truth.js: lorebook universe repair integration missing ${marker}`);
const refreshStart=sourceTruth.indexOf('async function refreshOne(env,uuid)');
const auditStart=sourceTruth.indexOf('async function auditStats(env)');
const refreshBody=refreshStart>=0&&auditStart>refreshStart?sourceTruth.slice(refreshStart,auditStart):'';
fail(refreshBody.includes('repairAffectedLorebookUniverses'),'src/source-truth.js: refreshOne must use targeted universe repair');
fail(!refreshBody.includes('repairUniversesFromLorebooks(env)'),'src/source-truth.js: refreshOne still invokes global universe repair');

if(errors.length){console.error('\nARCHIVE.EXE audit failed:\n- '+errors.join('\n- ')+'\n');process.exit(1)}
console.log(`ARCHIVE.EXE audit OK · ${sourceFiles.length} worker modules + inline scripts + publish lifecycle + SOURCE media R2 + public school-setting canonicalization + canonical visible tags + separate POV facet + passive list-card tags + single catalog render publication + semantic tag + hashtag normalization contract + public setting API canonicalization + admin filter value normalization + admin setting taxonomy contract + atomic lorebook delete lifecycle + bounded scans + zero runtime D1 DDL checked`);
