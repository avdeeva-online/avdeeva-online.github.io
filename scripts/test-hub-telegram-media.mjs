import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { publishHubResource, repairTelegramMedia } from '../src/hub-resources.js';
import { getHubResourcePublic, downloadHubFilePublic } from '../src/hub-public-media.js';

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
const pub=await (await publishHubResource(new Request('https://x.test/api/admin/hub-resource',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({source:{type:'telegram',url:'https://t.me/CHAN/4'},type:'preset',title:'New',media:[{url:`${CDN}live.jpg`,cover:true}]})}),env)).json();
assert.ok(pub.ok,JSON.stringify(pub));
let m=await media(pub.id);
assert.equal(m.length,1);assert.equal(m[0].cover,true);await storedOk(pub.id,m[0].url);

// 2. Existing resource with expired links (cover + old avatar entry) next to an uploaded image.
db.prepare("INSERT INTO hub_resources(id,source_url,type,title,media,status) VALUES('old','https://t.me/CHAN/5','preset','Old',?,'published')").run(JSON.stringify([{url:`${CDN}expired-cover.jpg`,cover:true},{url:'/api/hub-resources/old/media/9',cover:false},{url:`${CDN}expired-avatar.jpg`,cover:false}]));
const plan=await (await repairTelegramMedia(new Request('https://x.test/api/admin/hub-media-repair'),env)).json();
const planned=plan.report.find(x=>x.id==='old');
assert.equal(plan.mode,'dry-run');assert.equal(planned.result,'PLANNED');assert.equal(planned.replaced,1);assert.equal(planned.dropped,1);
assert.ok(JSON.parse(db.prepare("SELECT media FROM hub_resources WHERE id='old'").get().media)[0].url.includes('expired'),'dry run must not write');

const done=await (await repairTelegramMedia(new Request('https://x.test/api/admin/hub-media-repair',{method:'POST'}),env)).json();
assert.equal(done.report.find(x=>x.id==='old').result,'REPAIRED');
m=JSON.parse(db.prepare("SELECT media FROM hub_resources WHERE id='old'").get().media);
assert.equal(m.length,2,'expired avatar entry dropped, uploaded image kept');
assert.equal(m[0].cover,true);await storedOk('old',m[0].url);
assert.equal(m[1].url,'/api/hub-resources/old/media/9');

// 3. Running again finds nothing left to repair.
assert.equal((await (await repairTelegramMedia(new Request('https://x.test/api/admin/hub-media-repair'),env)).json()).resources,0);

console.log('ARCHIVE.EXE HUB Telegram media behavior OK · CDN covers stored on publish + expired covers repaired from source post, avatar skipped, other media untouched');
