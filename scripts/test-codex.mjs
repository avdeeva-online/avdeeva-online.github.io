import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handleCodexProfilesRoute } from '../src/codex-profiles.js';

// Real SQL on an in-memory SQLite built from the migrations, behind a minimal D1 shim; R2 is a Map.
const db=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('migrations').sort())db.exec(fs.readFileSync(`migrations/${f}`,'utf8'));
const stmt=(sql,args=[])=>({bind:(...a)=>stmt(sql,a),async first(){return db.prepare(sql).get(...args)??null},async all(){return{results:db.prepare(sql).all(...args)}},async run(){db.prepare(sql).run(...args);return{}},exec(){return db.prepare(sql).run(...args)}});
const r2=new Map();
const env={DB:{prepare:sql=>stmt(sql),async batch(list){for(const s of list)s.exec();return[]}},HUB_FILES:{async put(k,v,o){r2.set(k,{bytes:new Uint8Array(v),type:o?.httpMetadata?.contentType})},async get(k){const x=r2.get(k);return x?{body:x.bytes,httpMetadata:{contentType:x.type}}:null},async delete(k){r2.delete(k)}}};
const call=async(path,body)=>{const res=await handleCodexProfilesRoute(new Request(`https://x.test${path}`,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{}),env);return{status:res.status,data:await res.json().catch(()=>null),res}};
const png=`data:image/png;base64,${Buffer.from([137,80,78,71,1,2,3]).toString('base64')}`;

// Styles: create with a picture, list in order, prompt kept as written.
const a=await call('/api/admin/codex-styles',{action:'set',title:'Dressy Shorts',prompt:'clothes: tailored pinstripe bermuda shorts,\npearl drop earrings',model:'NovelAI v4.5',author:'@SATURIC',image:png});
assert.equal(a.status,200,JSON.stringify(a.data));
const b=await call('/api/admin/codex-styles',{action:'set',title:'Soft light',prompt:'soft rim light',model:'Nano Banana'});
let list=(await call('/api/codex-styles')).data.styles;
assert.deepEqual(list.map(s=>s.title),['Dressy Shorts','Soft light']);
assert.equal(list[0].prompt,'clothes: tailored pinstripe bermuda shorts,\npearl drop earrings','line breaks in the prompt are kept');
assert.equal(list[0].author,'SATURIC');assert.ok(list[0].image_url.startsWith('/api/codex-image?'));assert.equal(list[1].image_url,'');
const img=await call(list[0].image_url.replace('https://x.test',''));assert.equal(img.res.status,200);assert.equal(img.res.headers.get('content-type'),'image/png');

// Reorder, replace the picture (old object removed), refuse non-images and empty prompts.
await call('/api/admin/codex-styles',{action:'move',id:b.data.id,dir:-1});
assert.deepEqual((await call('/api/codex-styles')).data.styles.map(s=>s.title),['Soft light','Dressy Shorts']);
const png2=`data:image/png;base64,${Buffer.from([137,80,78,71,9,9]).toString('base64')}`;
await call('/api/admin/codex-styles',{action:'set',id:a.data.id,title:'Dressy Shorts',prompt:'x',image:png2});
assert.equal([...r2.keys()].filter(k=>k.startsWith('codex/styles/')).length,1,'replacing the picture leaves one object');
assert.equal((await call('/api/admin/codex-styles',{action:'set',title:'Bad',prompt:'x',image:'data:text/html;base64,PGI+'})).status,400);
assert.equal((await call('/api/admin/codex-styles',{action:'set',title:'No prompt',prompt:''})).status,400);
assert.equal((await call('/api/codex-image?key=../secret')).status,400,'only codex/ keys are served');

// Delete removes the row and its picture.
await call('/api/admin/codex-styles',{action:'delete',id:a.data.id});
assert.deepEqual((await call('/api/codex-styles')).data.styles.map(s=>s.title),['Soft light']);
assert.equal([...r2.keys()].filter(k=>k.startsWith('codex/styles/')).length,0);

// Imported from a Telegram post: source link kept, the picked photo fetched from the Telegram CDN only.
globalThis.fetch=async url=>{url=String(url);if(url.startsWith('https://cdn4.telesco.pe/'))return new Response(new Uint8Array([255,216,255,224,5,5]),{headers:{'content-type':'image/jpeg'}});return new Response('no',{status:404})};
const imp=await call('/api/admin/codex-styles',{action:'set',title:'From post',prompt:'pastel, soft light',model:'Nano Banana',author:'floryhibi',author_link:'https://t.me/floryhibi',source_url:'https://t.me/floryhibi/400',image_url:'https://cdn4.telesco.pe/file/abc.jpg'});
assert.equal(imp.status,200,JSON.stringify(imp.data));
const got=(await call('/api/codex-styles')).data.styles.find(s=>s.id===imp.data.id);
assert.equal(got.source_url,'https://t.me/floryhibi/400');assert.ok(got.image_url,'Telegram photo stored');
assert.equal((await call(got.image_url)).res.headers.get('content-type'),'image/jpeg');
assert.equal((await call('/api/admin/codex-styles',{action:'set',title:'Bad host',prompt:'x',image_url:'https://evil.example/a.jpg'})).status,400,'only the Telegram CDN is fetched');

// Several models per style: list in, list out (duplicates and empties dropped); a plain string still works.
const mm=await call('/api/admin/codex-styles',{action:'set',title:'Multi',prompt:'p',models:['NovelAI v4.5','NovelAI v5','novelai v5','']});
let ms=(await call('/api/codex-styles')).data.styles.find(s=>s.id===mm.data.id);
assert.deepEqual(ms.models,['NovelAI v4.5','NovelAI v5']);assert.equal(ms.model,'NovelAI v4.5, NovelAI v5');
await call('/api/admin/codex-styles',{action:'set',id:mm.data.id,title:'Multi',prompt:'p',model:'Nano Banana'});
ms=(await call('/api/codex-styles')).data.styles.find(s=>s.id===mm.data.id);assert.deepEqual(ms.models,['Nano Banana']);

// Gallery: several pictures in order (upload + post photo), reorder / drop one keeps the rest, removed objects deleted.
const g1=`data:image/png;base64,${Buffer.from([137,80,78,71,1,1]).toString('base64')}`,g2=`data:image/png;base64,${Buffer.from([137,80,78,71,2,2]).toString('base64')}`;
const gal=await call('/api/admin/codex-styles',{action:'set',title:'Gallery',prompt:'p',images:[{data:g1},{url:'https://cdn4.telesco.pe/file/x.jpg'},{data:g2}]});
assert.equal(gal.data.images,3,JSON.stringify(gal.data));
let adminStyle=(await call('/api/admin/codex-styles')).data.styles.find(s=>s.id===gal.data.id);
assert.equal(adminStyle.image_urls.length,3);
const [k1,k2,k3]=adminStyle.image_keys;
await call('/api/admin/codex-styles',{action:'set',id:gal.data.id,title:'Gallery',prompt:'p',images:[{key:k3},{key:k1}]});
adminStyle=(await call('/api/admin/codex-styles')).data.styles.find(s=>s.id===gal.data.id);
assert.deepEqual(adminStyle.image_keys,[k3,k1],'order follows the list');assert.equal(r2.has(k2),false,'dropped picture removed from storage');
const pub=(await call('/api/codex-styles')).data.styles.find(s=>s.id===gal.data.id);
assert.equal(pub.image_urls.length,2);assert.equal('image_keys' in pub,false,'storage keys stay private');
assert.equal((await call('/api/admin/codex-styles',{action:'set',id:gal.data.id,title:'Gallery',prompt:'p',images:[{key:'codex/styles/someone-else'}]})).status,400,'only own pictures can be kept');

// Author avatar: set, kept when omitted on a later save, removed with ''.
await call('/api/admin/codex-profiles',{action:'set',kind:'author',name:'floryhibi',description:'Hi',avatar:png});
let p=(await call('/api/codex-profiles')).data.profiles.find(x=>x.name==='floryhibi');assert.ok(p.avatar_url);
await call('/api/admin/codex-profiles',{action:'set',kind:'author',name:'floryhibi',description:'Hi again'});
p=(await call('/api/codex-profiles')).data.profiles.find(x=>x.name==='floryhibi');assert.ok(p.avatar_url,'avatar kept when not sent');assert.equal(p.description,'Hi again');
await call('/api/admin/codex-profiles',{action:'set',kind:'author',name:'floryhibi',description:'Hi again',avatar:''});
p=(await call('/api/codex-profiles')).data.profiles.find(x=>x.name==='floryhibi');assert.equal(p.avatar_url,'');
assert.equal([...r2.keys()].filter(k=>k.startsWith('codex/avatars/')).length,0);

console.log('ARCHIVE.EXE CODEX OK · styles (order, picture replace/delete, prompt kept, images only) + author avatars (set / keep / remove)');
