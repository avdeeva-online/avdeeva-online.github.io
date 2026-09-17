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

const retired=['telegram-admin-ingest.js','telegram-admin-smart.js','telegram-admin-bot.js','hub-media-recovery.js'];
for(const file of [...sourceFiles,...walk('public').filter(f=>/\.(?:js|html)$/.test(f))]){const text=read(file);for(const name of retired){if(text.includes(name))errors.push(`${file}: still references retired ${name}`)}}

for(const file of walk('public/admin/hub').filter(f=>f.endsWith('.js'))){const text=read(file);if(/window\.fetch\s*=/.test(text))errors.push(`${file}: fetch monkey patch reintroduced`)}

for(const file of walk('public').filter(f=>f.endsWith('.html'))){const html=read(file);for(const m of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type=["']module["'])[^>]*>([\s\S]*?)<\/script>/gi)){const code=m[1].trim();if(!code)continue;try{new Function(code)}catch(e){errors.push(`${file}: inline script syntax error: ${e.message}`)}}}

const wrangler=read('wrangler.toml');
for(const route of ['/admin/*','/api/*','/telegram/*','/hub.html'])fail(wrangler.includes(`"${route}"`),`wrangler.toml: run_worker_first missing ${route}`);
fail(wrangler.includes('main = "src/cloudflare-entry-v2.js"'),'wrangler.toml: unexpected worker entrypoint');
fail(wrangler.includes('[[r2_buckets]]')&&wrangler.includes('binding = "HUB_FILES"'),'wrangler.toml: HUB_FILES R2 binding missing');

const baseline='migrations/0001_baseline.sql';
fail(exists(baseline),'D1 baseline migration missing');
if(exists(baseline)){
  const sql=read(baseline);
  for(const table of ['characters','lorebooks','character_lorebooks','hub_resources','hub_resource_files','hub_resource_publish_sessions','telegram_admin_drafts','telegram_admin_import_session','hub_suggestions','universe_curation','admin_universe_review'])fail(sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`),`${baseline}: missing ${table}`);
  fail(sql.includes('storage TEXT NOT NULL DEFAULT \'d1\''),`${baseline}: HUB R2 storage column missing`);
  fail(sql.includes("r2_key TEXT NOT NULL DEFAULT ''"),`${baseline}: HUB r2_key column missing`);
}
const runtimeDdlAllowlist=new Set(['src/hub-resources.js','src/source-truth.js','src/telegram-admin-fixed.js','src/telegram-drafts-admin.js','src/universe-curation.js','src/main.js','src/hub-public-media.js','src/telegram-bots.js']);
for(const file of sourceFiles){const text=read(file);if(/\b(?:CREATE\s+(?:TABLE|INDEX)|ALTER\s+TABLE)\b/i.test(text)&&!runtimeDdlAllowlist.has(file))errors.push(`${file}: runtime D1 DDL is forbidden; add a numbered migration instead`)}
for(const file of ['src/hub-r2-migration.js','src/hub-suggestions.js']){const text=read(file);if(/\b(?:CREATE\s+(?:TABLE|INDEX)|ALTER\s+TABLE)\b/i.test(text))errors.push(`${file}: migrated module must not mutate D1 schema at runtime`);fail(text.includes('D1_MIGRATION_REQUIRED'),`${file}: missing explicit migration-required failure`)}

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

const resources=read('src/hub-resources.js');
for(const table of ['hub_resource_publish_sessions','hub_resource_publish_files'])fail(resources.includes(table),`src/hub-resources.js: staging table missing ${table}`);
fail(resources.includes("status='published'"),'src/hub-resources.js: published-state guard missing');
fail(resources.includes('cleanupStaleSessions'),'src/hub-resources.js: stale publish rollback missing');
for(const marker of ['HUB_FILES',"storage='r2'",'r2_key','R2_BINDING_REQUIRED'])fail(resources.includes(marker),`src/hub-resources.js: R2 dual-storage marker missing ${marker}`);

const migration=read('src/hub-r2-migration.js');
for(const marker of ['migrateHubFilesToR2Safe','hubStorageStatusSafe','HUB_FILES',"storage='r2'",'post-migration D1 cleanup failed'])fail(migration.includes(marker),`src/hub-r2-migration.js: safe migration marker missing ${marker}`);

const drafts=read('src/telegram-drafts-admin.js');
fail(!/telegram-extra-/i.test(drafts),'src/telegram-drafts-admin.js: SOURCE media is still converted to EXTRAS');
fail(drafts.includes("if('media'in b)"),'src/telegram-drafts-admin.js: media edits are not persisted');
const bridge=read('public/admin/hub/draft-bridge.js');
fail(bridge.includes('media:mediaPayload()'),'public/admin/hub/draft-bridge.js: Telegram draft media state not submitted');

const publicMedia=read('src/hub-public-media.js');
fail(!publicMedia.includes('legacyExtraIds'),'src/hub-public-media.js: legacy EXTRAS synthesis still active');
fail(!publicMedia.includes("source:'legacy-media'"),'src/hub-public-media.js: virtual media EXTRAS still active');
for(const marker of ['HUB_FILES','row.storage','row.r2_key','ensureStorageColumns'])fail(publicMedia.includes(marker),`src/hub-public-media.js: R2 read fallback missing ${marker}`);

if(errors.length){console.error('\nARCHIVE.EXE audit failed:\n- '+errors.join('\n- ')+'\n');process.exit(1)}
console.log(`ARCHIVE.EXE audit OK · ${sourceFiles.length} worker modules + inline scripts + publish lifecycle + R2 dual storage + D1 migration ownership checked`);
