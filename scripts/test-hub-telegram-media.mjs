import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { publishHubResource, repairHubMedia } from '../src/hub-resources.js';
import { getHubResourcePublic, downloadHubFilePublic } from '../src/hub-public-media.js';
import { postSummary, postTitle, tidyPostText } from '../src/hub-telegram.js';

// Real SQL on an in-memory SQLite built from the migrations, behind a minimal D1 shim; R2 is a Map.
const db=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('migrations').sort())db.exec(fs.readFileSync(`migrations/${f}`,'utf8'));
const norm=v=>v===undefined?null:v instanceof ArrayBuffer?new Uint8Array(v):v;
const stmt=(sql,args=[])=>({bind:(...a)=>stmt(sql,a),async first(){return db.prepare(sql).get(...args.map(norm))??null},async all(){return{results:db.prepare(sql).all(...args.map(norm))}},async run(){const r=db.prepare(sql).run(...args.map(norm));return{meta:{last_row_id:Number(r.lastInsertRowid),changes:r.changes}}},exec(){return db.prepare(sql).run(...args.map(norm))}});
const r2=new Map();
const env={DB:{prepare:sql=>stmt(sql),async batch(list){db.exec('BEGIN');try{for(const s of list)s.exec();db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return[]}},HUB_FILES:{async put(k,v){r2.set(k,new Uint8Array(v))},async get(k){const b=r2.get(k);return b?{body:b,size:b.byteLength}:null},async delete(k){r2.delete(k)}}};

// Stubbed network: Telegram post embed (photo + channel avatar) and the Telegram CDN.
const jpeg=new Uint8Array([255,216,255,224,1,2,3,4]),CDN='https://cdn4.telesco.pe/file/';
let fresh='fresh-photo';
globalThis.fetch=async url=>{
  url=String(url);
  if(url.startsWith('https://t.me/'))return new Response(`<div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="CHAN/5"><i class="tgme_widget_message_user_photo bgcolor2"><img src="${CDN}avatar.jpg"></i><a class="tgme_widget_message_photo_wrap" style="background-image:url('${CDN}${fresh}.jpg')"></a><div class="tgme_widget_message_text">Preset text long enough to be a post</div></div></div>`,{headers:{'content-type':'text/html'}});
  if(url.startsWith(CDN)&&!url.includes('expired'))return new Response(jpeg,{headers:{'content-type':'image/jpeg'}});
  return new Response('gone',{status:404});
};
const media=async id=>(await (await getHubResourcePublic(env,id)).json()).resource.media;
const storedOk=async(id,url)=>{const m=url.match(/files\/([^/?]+)/);assert.ok(m,`expected stored URL, got ${url}`);const r=await downloadHubFilePublic(new Request(`https://x.test${url}`),env,id,decodeURIComponent(m[1]));assert.equal(r.status,200);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),jpeg)};

// 1. Publishing with a Telegram CDN cover stores the image instead of the expiring link.
const pub=await (await publishHubResource(new Request('https://x.test/api/admin/hub-resource',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({source:{type:'telegram',url:'https://t.me/CHAN/4'},type:'preset',title:'New',creator:{name:'CHAN',link:'https://t.me/CHAN'},description_short:'Short text',description_full:'Full text',additional_info:'Extra text',media:[{url:`${CDN}live.jpg`,cover:true}]})}),env)).json();
assert.ok(pub.ok,JSON.stringify(pub));
const saved=db.prepare('SELECT * FROM hub_resources WHERE id=?').get(pub.id);
assert.deepEqual([saved.source_url,saved.creator_name,saved.creator_link,saved.description_short,saved.description_full,saved.additional_info],['https://t.me/CHAN/4','CHAN','https://t.me/CHAN','Short text','Full text','Extra text'],'publish must keep source URL, creator and descriptions');
let m=await media(pub.id);
assert.equal(m.length,1);assert.equal(m[0].cover,true);await storedOk(pub.id,m[0].url);

// 2. A manual cover (base64 data: URI) is stored as a file, not kept inside the D1 row.
const dataUri=`data:image/jpeg;base64,${Buffer.from(jpeg).toString('base64')}`;
const manual=await (await publishHubResource(new Request('https://x.test/api/admin/hub-resource',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({source:{type:'telegram',url:'https://t.me/CHAN/6'},type:'theme',title:'Manual',media:[{url:dataUri,cover:true,manual_cover:true}]})}),env)).json();
m=JSON.parse(db.prepare('SELECT media FROM hub_resources WHERE id=?').get(manual.id).media);
assert.equal(JSON.stringify(m).includes('data:image'),false,'data: URI must not stay in D1');await storedOk(manual.id,m[0].url);

// 3. Re-saving a legacy resource from the editor sends /media/N (what the public API shows); the old bytes are stored.
db.prepare("INSERT INTO hub_resources(id,source_url,type,title,media,status) VALUES('legacy','https://t.me/CHAN/7','preset','Legacy',?,'published')").run(JSON.stringify([{url:dataUri,cover:true}]));
const resaved=await (await publishHubResource(new Request('https://x.test/api/admin/hub-resource',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({editing_id:'legacy',source:{type:'telegram',url:'https://t.me/CHAN/7'},type:'preset',title:'Legacy edited',media:[{url:'https://x.test/api/hub-resources/legacy/media/0',cover:true}]})}),env)).json();
assert.ok(resaved.ok,JSON.stringify(resaved));
m=JSON.parse(db.prepare("SELECT media FROM hub_resources WHERE id='legacy'").get().media);
assert.equal(m[0].cover,true);await storedOk('legacy',m[0].url);

// 4. Existing resource with expired links (cover + old avatar entry) next to an embedded image.
db.prepare("INSERT INTO hub_resources(id,source_url,type,title,media,status) VALUES('old','https://t.me/CHAN/5','preset','Old',?,'published')").run(JSON.stringify([{url:`${CDN}expired-cover.jpg`,cover:true},{url:dataUri,cover:false},{url:`${CDN}expired-avatar.jpg`,cover:false}]));
const plan=await (await repairHubMedia(new Request('https://x.test/api/admin/hub-media-repair'),env)).json();
const planned=plan.report.find(x=>x.id==='old');
assert.equal(plan.mode,'dry-run');assert.equal(planned.result,'PLANNED');assert.equal(planned.replaced,1);assert.equal(planned.dropped,1);assert.equal(planned.embedded_entries,1);
assert.ok(JSON.parse(db.prepare("SELECT media FROM hub_resources WHERE id='old'").get().media)[0].url.includes('expired'),'dry run must not write');

const done=await (await repairHubMedia(new Request('https://x.test/api/admin/hub-media-repair',{method:'POST'}),env)).json();
assert.equal(done.report.find(x=>x.id==='old').result,'REPAIRED');
m=JSON.parse(db.prepare("SELECT media FROM hub_resources WHERE id='old'").get().media);
assert.equal(m.length,2,'expired avatar entry dropped, embedded image kept');
assert.equal(m[0].cover,true);await storedOk('old',m[0].url);await storedOk('old',m[1].url);

// 5. Running again finds nothing left to repair.
assert.equal((await (await repairHubMedia(new Request('https://x.test/api/admin/hub-media-repair'),env)).json()).resources,0);

// 6. Post text cleanup (samples from real channels).
const post='🎀🎀🎀\n\n🌫   🎀  ☺️овый\nSCP – ███⠀(«Shadow»)\n#psitro_presets\nMale/not a person/dominant/horror/AnyPOV\nВ глубоководном бункере Фонда SCP произошёл катастрофический прорыв.\n\n    Please open Telegram to view this post\n\n    VIEW IN TELEGRAM\n\n1282';
assert.equal(tidyPostText(post),'🌫   🎀  ☺️овый\nSCP – ███⠀(«Shadow»)\nMale/not a person/dominant/horror/AnyPOV\nВ глубоководном бункере Фонда SCP произошёл катастрофический прорыв.');
assert.equal(postTitle(post),'SCP – ███⠀(«Shadow»)','premium-emoji line skipped, first real line is the title');
assert.equal(postSummary(post),'В глубоководном бункере Фонда SCP произошёл катастрофический прорыв.','tag line skipped');
assert.equal(postTitle('Этот пресет станет основным для моего канала, я очень долго продумывала визуал.'),'','a long sentence is not a title');

console.log('ARCHIVE.EXE HUB media behavior OK · post text cleanup + Telegram CDN + manual covers stored as files, editor re-save keeps embedded cover, expired covers repaired from source post');
