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

const retired=['telegram-admin-ingest.js','telegram-admin-smart.js','telegram-admin-bot.js','hub-media-recovery.js','hub-extra-fix.js'];
for(const file of [...sourceFiles,...walk('public').filter(f=>/\.(?:js|html)$/.test(f))]){const text=read(file);for(const name of retired){if(text.includes(name))errors.push(`${file}: still references retired ${name}`)}}

for(const file of walk('public/admin/hub').filter(f=>f.endsWith('.js'))){const text=read(file);if(/window\.fetch\s*=/.test(text))errors.push(`${file}: fetch monkey patch reintroduced`)}

for(const file of walk('public').filter(f=>f.endsWith('.html'))){const html=read(file);for(const m of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type=["']module["'])[^>]*>([\s\S]*?)<\/script>/gi)){const code=m[1].trim();if(!code)continue;try{new Function(code)}catch(e){errors.push(`${file}: inline script syntax error: ${e.message}`)}}}

const wrangler=read('wrangler.toml');
for(const route of ['/admin/*','/api/*','/telegram/*','/hub.html'])fail(wrangler.includes(`"${route}"`),`wrangler.toml: run_worker_first missing ${route}`);
fail(wrangler.includes('main = "src/cloudflare-entry-v2.js"'),'wrangler.toml: unexpected worker entrypoint');

const hub=read('public/hub-dynamic.js');
fail(hub.includes('extraFile(f)&&imageFile(f)'),'public/hub-dynamic.js: EXTRAS must use explicit extra flag');
fail(hub.includes('downloadFiles=files.filter(f=>!extraFile(f))'),'public/hub-dynamic.js: downloads must exclude EXTRAS');

const catalog=read('public/characters.html');
if(/id=["']importOpen["']/.test(catalog))errors.push('public/characters.html: public import control returned');

const entry=read('src/cloudflare-entry-v2.js');
fail(entry.includes("url.pathname==='/api/import'"),'src/cloudflare-entry-v2.js: public import guard missing');
fail(entry.includes("url.pathname==='/api/debug/datacat'"),'src/cloudflare-entry-v2.js: public debug guard missing');

const adminEdit=read('public/admin/hub/admin-edit.js');
for(const action of ['action=begin','action=upload','action=finalize','action=cancel'])fail(adminEdit.includes(action),`public/admin/hub/admin-edit.js: staged publish missing ${action}`);
const resources=read('src/hub-resources.js');
for(const table of ['hub_resource_publish_sessions','hub_resource_publish_files'])fail(resources.includes(table),`src/hub-resources.js: staging table missing ${table}`);
fail(resources.includes("status='published'"),'src/hub-resources.js: published-state guard missing');
fail(resources.includes('cleanupStaleSessions'),'src/hub-resources.js: stale publish rollback missing');
const drafts=read('src/telegram-drafts-admin.js');
fail(!/telegram-extra-/i.test(drafts),'src/telegram-drafts-admin.js: SOURCE media is still converted to EXTRAS');
fail(drafts.includes("if('media'in b)"),'src/telegram-drafts-admin.js: media edits are not persisted');
const bridge=read('public/admin/hub/draft-bridge.js');
fail(bridge.includes('media:mediaPayload()'),'public/admin/hub/draft-bridge.js: Telegram draft media state not submitted');
const publicMedia=read('src/hub-public-media.js');
fail(!publicMedia.includes('legacyExtraIds'),'src/hub-public-media.js: legacy EXTRAS synthesis still active');
fail(!publicMedia.includes("source:'legacy-media'"),'src/hub-public-media.js: virtual media EXTRAS still active');

if(errors.length){console.error('\nARCHIVE.EXE audit failed:\n- '+errors.join('\n- ')+'\n');process.exit(1)}
console.log(`ARCHIVE.EXE audit OK · ${sourceFiles.length} worker modules + inline scripts + publish lifecycle checked`);