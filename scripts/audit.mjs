import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const errors=[];
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
const walk=dir=>{const out=[];for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const rel=path.join(dir,e.name);if(e.isDirectory())out.push(...walk(rel));else out.push(rel)}return out};

const sourceFiles=walk('src').filter(f=>f.endsWith('.js'));
for(const file of sourceFiles){const text=read(file);for(const m of text.matchAll(/(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"](\.\.?\/[^'"]+)['"]/g)){let target=path.normalize(path.join(path.dirname(file),m[1]));if(!path.extname(target))target+='.js';if(!exists(target))errors.push(`${file}: missing import ${m[1]} -> ${target}`)}}

const retired=['telegram-admin-ingest.js','telegram-admin-smart.js','telegram-admin-bot.js','hub-media-recovery.js'];
for(const file of [...sourceFiles,...walk('public').filter(f=>/\.(?:js|html)$/.test(f))]){const text=read(file);for(const name of retired){if(text.includes(name))errors.push(`${file}: still references retired ${name}`)}}

for(const file of walk('public/admin/hub').filter(f=>f.endsWith('.js'))){const text=read(file);if(/window\.fetch\s*=/.test(text))errors.push(`${file}: fetch monkey patch reintroduced`)}

const wrangler=read('wrangler.toml');
for(const route of ['/admin/*','/api/*','/telegram/*','/hub.html'])if(!wrangler.includes(`"${route}"`))errors.push(`wrangler.toml: run_worker_first missing ${route}`);
if(!wrangler.includes('main = "src/cloudflare-entry-v2.js"'))errors.push('wrangler.toml: unexpected worker entrypoint');

const hub=read('public/hub-dynamic.js');
if(!hub.includes('extraFile(f)&&imageFile(f)'))errors.push('public/hub-dynamic.js: EXTRAS must use explicit extra flag');
if(!hub.includes('downloadFiles=files.filter(f=>!extraFile(f))'))errors.push('public/hub-dynamic.js: downloads must exclude EXTRAS');

const catalog=read('public/characters.html');
if(/id=["']importOpen["']/.test(catalog))errors.push('public/characters.html: public import control returned');

const entry=read('src/cloudflare-entry-v2.js');
if(!entry.includes("url.pathname==='/api/import'"))errors.push('src/cloudflare-entry-v2.js: public import guard missing');
if(!entry.includes("url.pathname==='/api/debug/datacat'"))errors.push('src/cloudflare-entry-v2.js: public debug guard missing');

if(errors.length){console.error('\nARCHIVE.EXE audit failed:\n- '+errors.join('\n- ')+'\n');process.exit(1)}
console.log(`ARCHIVE.EXE audit OK · ${sourceFiles.length} worker modules checked`);
